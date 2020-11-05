// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { assert } from 'chai';
import * as path from 'path';
import { FileChangeType } from '../../../../client/common/platform/fileSystemWatcher';
import { createDeferred, Deferred, sleep } from '../../../../client/common/utils/async';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import { GlobalVirtualEnvironmentLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/globalVirtualEnvronmentLocator';
import { deleteFiles, PYTHON_PATH } from '../../../common';
import { TEST_TIMEOUT } from '../../../constants';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { run } from './envTestUtils';

const testVirtualHomeDir = path.join(TEST_LAYOUT_ROOT, 'virtualhome');
const testWorkOnHomePath = path.join(testVirtualHomeDir, 'workonhome');

class GlobalVenvs {
    constructor(private readonly prefix = '.virtualenv-') { }

    public async create(name: string): Promise<string> {
        const envName = this.resolve(name);
        const argv = [PYTHON_PATH.fileToCommandArgument(), '-m', 'virtualenv', envName];
        try {
            await run(argv, { cwd: testWorkOnHomePath });
        } catch (err) {
            throw new Error(`Failed to create Env ${path.basename(envName)} Error: ${err}`);
        }
        return envName;
    }

    public async cleanUp() {
        const globPattern = path.join(testWorkOnHomePath, `${this.prefix}*`);
        await deleteFiles(globPattern);
    }

    public resolve(name: string): string {
        // Ensure env is random to avoid conflicts in tests (corrupting test data)
        const now = new Date().getTime().toString().substr(-8);
        return `${this.prefix}${name}${now}`;
    }
}

suite('GlobalVirtualEnvironment Locator', async () => {
    const globalVenvs = new GlobalVenvs();
    let locator: GlobalVirtualEnvironmentLocator;

    async function waitForEnvironmentToBeDetected(deferred: Deferred<void>, envName: string) {
        const timeout = setTimeout(() => {
            clearTimeout(timeout);
            deferred.reject(new Error('Environment not detected'));
        }, TEST_TIMEOUT);
        await deferred.promise;
        const items = await getEnvs(locator.iterEnvs());
        const result = items.some((item) => item.executable.filename.includes(envName));
        assert.ok(result);
    }

    suiteSetup(() => globalVenvs.cleanUp());
    setup(async () => {
        process.env.WORKON_HOME = testWorkOnHomePath;
        locator = new GlobalVirtualEnvironmentLocator();
        await locator.initialize();
        // Wait for watchers to get ready
        await sleep(1000);
    });
    teardown(async () => {
        await globalVenvs.cleanUp();
    });
    suiteTeardown(() => globalVenvs.cleanUp());

    test('Detect a new Virtual Environment', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        locator.onChanged(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });
        const envName = await globalVenvs.create('one');
        await waitForEnvironmentToBeDetected(deferred, envName);
        // Detecting kind of virtual env depends on the file structure around the executable, so we need to wait before
        // attempting to verify it. Omitting that check as we can never deterministically say when it's ready to check.
        assert.deepEqual(actualEvent!.type, FileChangeType.Created, 'Wrong event emitted');
    });
});
