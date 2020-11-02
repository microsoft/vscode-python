// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileChangeType } from '../../../../client/common/platform/fileSystemWatcher';
import { createDeferred, Deferred, sleep } from '../../../../client/common/utils/async';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import { arePathsSame } from '../../../../client/pythonEnvironments/common/externalDependencies';
import { WindowsStoreLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreLocator';
import { TEST_TIMEOUT } from '../../../constants';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';

const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');
const testExecutablePath = path.join(testStoreAppRoot, 'python3.4.exe');

class WindowsStoreEnvs {
    private executablePath = testExecutablePath;

    public async create(): Promise<void> {
        try {
            await fs.createFile(this.executablePath);
        } catch (err) {
            throw new Error(`Failed to create Windows Apps executable, Error: ${err}`);
        }
    }

    public async update(): Promise<void> {
        try {
            await fs.writeFile(this.executablePath, 'Environment has been updated');
        } catch (err) {
            throw new Error(`Failed to update Windows Apps executable, Error: ${err}`);
        }
    }

    public async cleanUp() {
        await fs.remove(this.executablePath);
    }
}

suite('Windows Store Locator', async () => {
    const windowsStoreEnvs = new WindowsStoreEnvs();
    let locator: WindowsStoreLocator;
    const localAppDataOldValue = process.env.LOCALAPPDATA;

    async function waitForChangeToBeDetected(
        deferred: Deferred<void>,
        check: FileChangeType,
    ) {
        const timeout = setTimeout(() => {
            clearTimeout(timeout);
            deferred.reject(new Error('Environment not detected'));
        }, TEST_TIMEOUT);
        await deferred.promise;
        const items = await getEnvs(locator.iterEnvs());
        const result = items.some((item) => arePathsSame(item.executable.filename, testExecutablePath));
        if (check === FileChangeType.Created || check === FileChangeType.Changed) {
            assert.ok(result);
        } else if (check === FileChangeType.Deleted) {
            assert.notOk(result);
        }
    }

    suiteSetup(async () => {
        process.env.LOCALAPPDATA = testLocalAppData;
        await windowsStoreEnvs.cleanUp();
    });
    setup(async () => {
        locator = new WindowsStoreLocator();
        locator.initialize();
        // Wait for watchers to get ready
        await sleep(1000);
    });
    teardown(() => windowsStoreEnvs.cleanUp());
    suiteTeardown(async () => {
        process.env.LOCALAPPDATA = localAppDataOldValue;
        await windowsStoreEnvs.cleanUp();
    });

    test('Detect a new environment', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        locator.onChanged(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await windowsStoreEnvs.create();
        await waitForChangeToBeDetected(deferred, FileChangeType.Created);

        const expectedEvent = {
            kind: PythonEnvKind.WindowsStore,
            type: FileChangeType.Created,
        };
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });

    test('Detect when an environment has been deleted', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        await windowsStoreEnvs.create();
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(100);
        locator.onChanged(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await windowsStoreEnvs.cleanUp();
        await waitForChangeToBeDetected(deferred, FileChangeType.Deleted);

        const expectedEvent = {
            kind: PythonEnvKind.WindowsStore,
            type: FileChangeType.Deleted,
        };
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });

    test('Detect when an environment has been updated', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        await windowsStoreEnvs.create();
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(100);
        locator.onChanged(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await windowsStoreEnvs.update();
        await waitForChangeToBeDetected(deferred, FileChangeType.Changed);

        const expectedEvent = {
            kind: PythonEnvKind.WindowsStore,
            type: FileChangeType.Changed,
        };
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });
});
