// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { assert } from 'chai';
import * as path from 'path';
import { FileChangeType } from '../../../../client/common/platform/fileSystemWatcher';
import { createDeferred, Deferred, sleep } from '../../../../client/common/utils/async';
import { IDisposableLocator } from '../../../../client/pythonEnvironments/base/locator';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import { arePathsSame } from '../../../../client/pythonEnvironments/common/externalDependencies';
import { createGlobalVirtualEnvironmentLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/globalVirtualEnvronmentLocator';
import { TEST_TIMEOUT } from '../../../constants';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { Venvs } from './envTestUtils';

suite('GlobalVirtualEnvironment Locator', async () => {
    const testVirtualHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualhome');
    const testWorkOnHomePath = path.join(testVirtualHomeDir, 'workonhome');
    const globalVenvs = new Venvs(testWorkOnHomePath);
    let workonHomeOldValue: string | undefined;
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
        workonHomeOldValue = process.env.WORKON_HOME;
        process.env.WORKON_HOME = testWorkOnHomePath;
        await globalVenvs.cleanUp();
    });

    async function setupLocator(onChanged: (e: PythonEnvsChangedEvent) => Promise<void>) {
        locator = await createGlobalVirtualEnvironmentLocator();
        // Wait for watchers to get ready
        await sleep(1000);
        locator.onChanged(onChanged);
    }

    teardown(async () => {
        await globalVenvs.cleanUp();
        locator.dispose();
    });

    suiteTeardown(() => {
        process.env.WORKON_HOME = workonHomeOldValue;
    });

    test('Detect a new environment', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        const executable = await globalVenvs.create('one');
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.ok(isFound);
        // Detecting kind of virtual env depends on the file structure around the executable, so we need to wait before
        // attempting to verify it. Omitting that check as we can never deterministically say when it's ready to check.
        assert.deepEqual(actualEvent!.type, FileChangeType.Created, 'Wrong event emitted');
    });

    test('Detect when an environment has been deleted', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const executable = await globalVenvs.create('one');
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
        await globalVenvs.delete(executable);
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.notOk(isFound);
        assert.deepEqual(actualEvent!.type, FileChangeType.Deleted, 'Wrong event emitted');
    });

    test('Detect when an environment has been updated', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        // Create a dummy environment so we can update its executable later. We can't choose a real environment here.
        // Executables inside real environments can be symlinks, so writing on them can result in the real executable
        // being updated instead of the symlink.
        const executable = await globalVenvs.createDummyEnv('one');
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(2000);
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await globalVenvs.update(executable);
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.ok(isFound);
        // Detecting kind of virtual env depends on the file structure around the executable, so we need to wait before
        // attempting to verify it. Omitting that check as we can never deterministically say when it's ready to check.
        assert.deepEqual(actualEvent!.type, FileChangeType.Changed, 'Wrong event emitted');
    });
});
