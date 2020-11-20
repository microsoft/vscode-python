// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { traceWarning } from '../../../../client/common/logger';
import { FileChangeType } from '../../../../client/common/platform/fileSystemWatcher';
import { createDeferred, Deferred, sleep } from '../../../../client/common/utils/async';
import { getOSType, OSType } from '../../../../client/common/utils/platform';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { IDisposableLocator } from '../../../../client/pythonEnvironments/base/locator';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import { getInterpreterPathFromDir } from '../../../../client/pythonEnvironments/common/commonUtils';
import { arePathsSame } from '../../../../client/pythonEnvironments/common/externalDependencies';
import { createPyenvLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/pyenvLocator';
import { deleteFiles, PYTHON_PATH } from '../../../common';
import { TEST_TIMEOUT } from '../../../constants';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { run } from './envTestUtils';

class PyenvVenvs {
    constructor(private readonly root: string, private readonly prefix = '.pyenv-') { }

    public async create(name: string): Promise<string> {
        const envName = this.resolve(name);
        const argv = [PYTHON_PATH.fileToCommandArgument(), '-m', 'virtualenv', envName];
        try {
            await run(argv, { cwd: this.root });
        } catch (err) {
            throw new Error(`Failed to create Env ${path.basename(envName)} Error: ${err}`);
        }
        const dirToLookInto = path.join(this.root, envName);
        const filename = await getInterpreterPathFromDir(dirToLookInto);
        if (!filename) {
            throw new Error(`No environment to update exists in ${dirToLookInto}`);
        }
        return filename;
    }

    /**
     * Creates a dummy environment by creating a fake executable.
     * @param name environment suffix name to create
     */
    public async createDummyEnv(name: string): Promise<string> {
        const envName = this.resolve(name);
        const filepath = path.join(this.root, envName, getOSType() === OSType.Windows ? 'python.exe' : 'python');
        try {
            await fs.createFile(filepath);
        } catch (err) {
            throw new Error(`Failed to create python executable ${filepath}, Error: ${err}`);
        }
        return filepath;
    }

    // eslint-disable-next-line class-methods-use-this
    public async update(filename: string): Promise<void> {
        try {
            await fs.writeFile(filename, 'Environment has been updated');
        } catch (err) {
            throw new Error(`Failed to update pyenv executable ${filename}, Error: ${err}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    public async delete(filename: string): Promise<void> {
        try {
            await fs.remove(filename);
        } catch (err) {
            traceWarning(`Failed to clean up ${filename}`);
        }
    }

    public async cleanUp() {
        const globPattern = path.join(this.root, `${this.prefix}*`);
        await deleteFiles(globPattern);
    }

    private resolve(name: string): string {
        // Ensure env is random to avoid conflicts in tests (corrupting test data)
        const now = new Date().getTime().toString().substr(-8);
        return `${this.prefix}${name}${now}`;
    }
}

suite('Pyenv Locator', async () => {
    const testPyenvRoot = path.join(TEST_LAYOUT_ROOT, 'pyenvhome', '.pyenv');
    const testPyenvVersionsDir = path.join(testPyenvRoot, 'versions');
    const pyenvVenvs = new PyenvVenvs(testPyenvVersionsDir);
    let pyenvRootOldValue: string | undefined;
    let locator: IDisposableLocator;

    async function waitForChangeToBeDetected(deferred: Deferred<void>) {
        const timeout = setTimeout(
            () => {
                clearTimeout(timeout);
                deferred.reject(new Error('Environment not detected'));
            },
            TEST_TIMEOUT,
        );
        await deferred.promise;
    }

    async function isLocated(executable: string): Promise<boolean> {
        const items = await getEnvs(locator.iterEnvs());
        return items.some((item) => arePathsSame(item.executable.filename, executable));
    }

    suiteSetup(async () => {
        pyenvRootOldValue = process.env.PYENV_ROOT;
        process.env.PYENV_ROOT = testPyenvRoot;
        await pyenvVenvs.cleanUp();
    });

    async function setupLocator(onChanged: (e: PythonEnvsChangedEvent) => Promise<void>) {
        locator = await createPyenvLocator();
        // Wait for watchers to get ready
        await sleep(1000);
        locator.onChanged(onChanged);
    }

    teardown(async () => {
        await pyenvVenvs.cleanUp();
        locator.dispose();
    });

    suiteTeardown(() => {
        process.env.PYENV_ROOT = pyenvRootOldValue;
    });

    test('Detect a new environment', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const expectedEvent = {
            kind: PythonEnvKind.Pyenv,
            type: FileChangeType.Created,
        };
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        const executable = await pyenvVenvs.create('one');
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.ok(isFound);
        // Detecting kind of virtual env depends on the file structure around the executable, so we need to wait before
        // attempting to verify it. Omitting that check as we can never deterministically say when it's ready to check.
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });

    test('Detect when an environment has been deleted', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const expectedEvent = {
            kind: PythonEnvKind.Pyenv,
            type: FileChangeType.Deleted,
        };
        const executable = await pyenvVenvs.create('one');
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(100);
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        // VSCode API has a limitation where it fails to fire event when environment folder is deleted directly:
        // https://github.com/microsoft/vscode/issues/110923
        // Using chokidar directly in tests work, but it has permission issues on Windows that you cannot delete a
        // folder if it has a subfolder that is being watched inside: https://github.com/paulmillr/chokidar/issues/422
        // Hence we test directly deleting the executable, and not the whole folder using `workspaceVenvs.cleanUp()`.
        await pyenvVenvs.delete(executable);
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.notOk(isFound);
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });

    test('Detect when an environment has been updated', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const expectedEvent = {
            kind: PythonEnvKind.Pyenv,
            type: FileChangeType.Changed,
        };
        // Create a dummy environment so we can update its executable later. We can't choose a real environment here.
        // Executables inside real environments can be symlinks, so writing on them can result in the real executable
        // being updated instead of the symlink.
        const executable = await pyenvVenvs.createDummyEnv('one');
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(100);
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await pyenvVenvs.update(executable);
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.ok(isFound);
        // Detecting kind of virtual env depends on the file structure around the executable, so we need to wait before
        // attempting to verify it. Omitting that check as we can never deterministically say when it's ready to check.
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });
});
