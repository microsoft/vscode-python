// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
import { expect } from 'chai';
import { exec } from 'child_process';
import * as path from 'path';
import { Uri } from 'vscode';
import '../../../client/common/extensions';
import { createDeferredFromPromise, Deferred } from '../../../client/common/utils/async';
import { StopWatch } from '../../../client/common/utils/stopWatch';
import {
    IInterpreterLocatorService,
    IInterpreterWatcherBuilder,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../../client/interpreter/contracts';
import { WorkspaceVirtualEnvWatcherService } from '../../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IServiceContainer } from '../../../client/ioc/types';
import { deleteFiles, isPythonVersionInProcess, PYTHON_PATH, rootWorkspaceUri, waitForCondition } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { sleep } from '../../core';
import { initialize, multirootPath } from '../../initialize';

const timeoutMs = 60_000;
suite('Interpreters - Workspace VirtualEnv Service', function() {
    this.timeout(timeoutMs);
    this.retries(0);

    let locator: IInterpreterLocatorService;
    const workspaceUri = IS_MULTI_ROOT_TEST ? Uri.file(path.join(multirootPath, 'workspace3')) : rootWorkspaceUri!;
    const workspace4 = Uri.file(path.join(multirootPath, 'workspace4'));
    const venvPrefix = '.venv';
    let serviceContainer: IServiceContainer;

    async function manuallyTriggerFSWatcher(deferred: Deferred<void>) {
        // Monitoring files on virtualized environments can be finicky...
        // Lets trigger the fs watcher manually for the tests.
        const stopWatch = new StopWatch();
        const builder = serviceContainer.get<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder);
        const watcher = (await builder.getWorkspaceVirtualEnvInterpreterWatcher(
            workspaceUri
        )) as WorkspaceVirtualEnvWatcherService;
        while (!deferred.completed && stopWatch.elapsedTime < timeoutMs - 10_000) {
            watcher.createHandler(workspaceUri).ignoreErrors();
            await sleep(1000);
        }
    }
    async function waitForInterpreterToBeDetected(envNameToLookFor: string) {
        const predicate = async () => {
            const items = await locator.getInterpreters(workspaceUri);
            return items.some(item => item.envName === envNameToLookFor);
        };
        const promise = waitForCondition(
            predicate,
            timeoutMs,
            `${envNameToLookFor}, Environment not detected in the workspace ${workspaceUri.fsPath}`
        );
        const deferred = createDeferredFromPromise(promise);
        manuallyTriggerFSWatcher(deferred).ignoreErrors();
        await deferred.promise;
    }
    async function createVirtualEnvironment(envSuffix: string) {
        // Ensure env is random to avoid conflicts in tests (currupting test data).
        const envName = `${venvPrefix}${envSuffix}${new Date().getTime().toString()}`;
        return new Promise<string>((resolve, reject) => {
            exec(
                `${PYTHON_PATH.fileToCommandArgument()} -m venv ${envName}`,
                { cwd: workspaceUri.fsPath },
                (ex, _, stderr) => {
                    if (ex) {
                        return reject(ex);
                    }
                    if (stderr && stderr.length > 0) {
                        reject(new Error(`Failed to create Env ${envName}, ${PYTHON_PATH}, Error: ${stderr}`));
                    } else {
                        resolve(envName);
                    }
                }
            );
        });
    }

    suiteSetup(async function() {
        // skip for Python < 3, no venv support
        if (await isPythonVersionInProcess(undefined, '2')) {
            return this.skip();
        }

        serviceContainer = (await initialize()).serviceContainer;
        locator = serviceContainer.get<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            WORKSPACE_VIRTUAL_ENV_SERVICE
        );
        // This test is required, we need to wait for interpreter listing completes,
        // before proceeding with other tests.
        await deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`));
        await locator.getInterpreters(workspaceUri);
    });

    suiteTeardown(async () => deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`)));
    teardown(async () => deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`)));

    test('Detect Virtual Environment', async () => {
        const envName = await createVirtualEnvironment('one');
        await waitForInterpreterToBeDetected(envName);
    });

    test('Detect a new Virtual Environment', async () => {
        const env1 = await createVirtualEnvironment('first');
        await waitForInterpreterToBeDetected(env1);

        // Ensure second environment in our workspace folder is detected when created.
        const env2 = await createVirtualEnvironment('second');
        await waitForInterpreterToBeDetected(env2);
    });

    test('Detect a new Virtual Environment, and other workspace folder must not be affected (multiroot)', async function() {
        if (!IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        // There should be nothing in workspacec4.
        let items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);

        const [env1, env2] = await Promise.all([
            createVirtualEnvironment('first3'),
            createVirtualEnvironment('second3')
        ]);
        await Promise.all([waitForInterpreterToBeDetected(env1), waitForInterpreterToBeDetected(env2)]);

        // Workspace4 should still not have any interpreters.
        items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);
    });
});
