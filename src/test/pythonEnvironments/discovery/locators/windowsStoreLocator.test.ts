// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { traceWarning } from '../../../../client/common/logger';
import { FileChangeType } from '../../../../client/common/platform/fileSystemWatcher';
import { createDeferred, Deferred, sleep } from '../../../../client/common/utils/async';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PythonEnvsChangedEvent } from '../../../../client/pythonEnvironments/base/watcher';
import { arePathsSame } from '../../../../client/pythonEnvironments/common/externalDependencies';
import { WindowsStoreLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/windowsStoreLocator';
import { TEST_TIMEOUT } from '../../../constants';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';

class WindowsStoreEnvs {
    private executables: string[] = [];

    constructor(private readonly storeAppRoot: string) {}

    public async create(basename: string): Promise<string> {
        const filename = path.join(this.storeAppRoot, basename);
        try {
            await fs.createFile(filename);
        } catch (err) {
            throw new Error(`Failed to create Windows Apps executable ${filename}, Error: ${err}`);
        }
        this.executables.push(filename);
        return filename;
    }

    public async update(basename: string): Promise<void> {
        const filename = path.join(this.storeAppRoot, basename);
        try {
            await fs.writeFile(filename, 'Environment has been updated');
        } catch (err) {
            throw new Error(`Failed to update Windows Apps executable ${filename}, Error: ${err}`);
        }
    }

    public async cleanUp() {
        await Promise.all(
            this.executables.map(async (filename: string) => {
                try {
                    await fs.remove(filename);
                } catch (err) {
                    traceWarning(`Failed to clean up ${filename}`);
                }
            }),
        );
    }
}

suite('Windows Store Locator', async () => {
    const testLocalAppData = path.join(TEST_LAYOUT_ROOT, 'storeApps');
    const testStoreAppRoot = path.join(testLocalAppData, 'Microsoft', 'WindowsApps');
    const windowsStoreEnvs = new WindowsStoreEnvs(testStoreAppRoot);
    let locator: WindowsStoreLocator;
    const localAppDataOldValue = process.env.LOCALAPPDATA;

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
        process.env.LOCALAPPDATA = testLocalAppData;
        await windowsStoreEnvs.cleanUp();
    });

    async function setupLocator(onChanged: (e: PythonEnvsChangedEvent) => Promise<void>) {
        locator = new WindowsStoreLocator();
        locator.initialize();
        // Wait for watchers to get ready
        await sleep(1000);
        locator.onChanged(onChanged);
    }

    teardown(() => windowsStoreEnvs.cleanUp());
    suiteTeardown(async () => {
        process.env.LOCALAPPDATA = localAppDataOldValue;
    });

    test('Detect a new environment', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const expectedEvent = {
            kind: PythonEnvKind.WindowsStore,
            type: FileChangeType.Created,
        };
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        const executable = await windowsStoreEnvs.create('python3.4.exe');
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.ok(isFound);
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });

    test('Detect when an environment has been deleted', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const expectedEvent = {
            kind: PythonEnvKind.WindowsStore,
            type: FileChangeType.Deleted,
        };
        const executable = await windowsStoreEnvs.create('python3.4.exe');
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(100);
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await windowsStoreEnvs.cleanUp();
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.notOk(isFound);
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });

    test('Detect when an environment has been updated', async () => {
        let actualEvent: PythonEnvsChangedEvent;
        const deferred = createDeferred<void>();
        const expectedEvent = {
            kind: PythonEnvKind.WindowsStore,
            type: FileChangeType.Changed,
        };
        const executable = await windowsStoreEnvs.create('python3.4.exe');
        // Wait before the change event has been sent. If both operations occur almost simultaneously no event is sent.
        await sleep(100);
        await setupLocator(async (e) => {
            actualEvent = e;
            deferred.resolve();
        });

        await windowsStoreEnvs.update('python3.4.exe');
        await waitForChangeToBeDetected(deferred);
        const isFound = await isLocated(executable);

        assert.ok(isFound);
        assert.deepEqual(actualEvent!, expectedEvent, 'Wrong event emitted');
    });
});
