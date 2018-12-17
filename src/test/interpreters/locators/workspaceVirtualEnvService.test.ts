// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this no-console
import { expect } from 'chai';
import { exec } from 'child_process';
import * as path from 'path';
import { Uri } from 'vscode';
import '../../../client/common/extensions';
import { IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { deleteFiles, isPythonVersionInProcess, PYTHON_PATH, rootWorkspaceUri, waitForCondition } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { initialize, multirootPath } from '../../initialize';

const timeoutMs = 180_000;
suite('Interpreters - Workspace VirtualEnv Service', function () {
    this.timeout(timeoutMs);
    this.retries(1);

    let locator: IInterpreterLocatorService;
    const workspaceUri = IS_MULTI_ROOT_TEST ? Uri.file(path.join(multirootPath, 'workspace3')) : rootWorkspaceUri!;
    const workspace4 = Uri.file(path.join(multirootPath, 'workspace4'));
    const venvPrefix = '.venv';
    let serviceContainer: IServiceContainer;

    async function waitForInterpreterToBeDetected(envNameToLookFor: string) {
        const predicate = async () => {
            const items = await locator.getInterpreters(workspaceUri);
            return items.some(item => item.envName === envNameToLookFor && !item.cachedEntry);
        };
        await waitForCondition(predicate, timeoutMs, `${envNameToLookFor}, Environment not detected in the workspace ${workspaceUri.fsPath}`);
    }
    async function createVirtualEnvironment(envSuffix: string) {
        // Ensure env is random to avoid conflicts in tests (currupting test data).
        const envName = `${venvPrefix}${envSuffix}${new Date().getTime().toString()}`;
        return new Promise<string>((resolve, reject) => {
            console.log(`Starting to create ${envSuffix} with name ${envName}`);
            exec(`${PYTHON_PATH.fileToCommandArgument()} -m venv ${envName}`, { cwd: workspaceUri.fsPath }, (ex, stdout, stderr) => {
                // tslint:disable-next-line:no-console
                console.log(stdout);
                if (ex) {
                    // tslint:disable-next-line:no-console
                    console.error(ex);
                    return reject(ex);
                }
                if (stderr && stderr.length > 0) {
                    // tslint:disable-next-line:no-console
                    console.error(stderr);
                    const err = new Error(`Failed to create Env ${envName}, ${PYTHON_PATH}, Error: ${stderr}`);
                    reject(err);
                } else {
                    // tslint:disable-next-line:no-console
                    console.log(`Created ${envSuffix} with name ${envName}`);
                    resolve(envName);
                }
            });
        });
    }

    suiteSetup(async function () {
        if (!await isPythonVersionInProcess(undefined, '3')) {
            return this.skip();
        }
        serviceContainer = (await initialize()).serviceContainer;
        locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);

        await deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`));
    });

    suiteTeardown(() => deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`)));
    teardown(() => deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`)));

    test('Detect Virtual Environment', async () => {
        setTimeout(() => {
            console.error('About to fail test due to timeout');
        }, timeoutMs - 30);
        console.log('start test');
        const envName = await createVirtualEnvironment('one');
        console.log('created env & waiting');
        await waitForInterpreterToBeDetected(envName);
    });

    test('Detect a new Virtual Environment', async () => {
        setTimeout(() => {
            console.error('About to fail test due to timeout');
        }, (timeoutMs * 2) - 30);
        console.log('start test');
        const env1 = await createVirtualEnvironment('first');
        console.log('created env & waiting');

        await waitForInterpreterToBeDetected(env1);
        console.log('start test with second env');

        // Ensure second environment in our workspace folder is detected when created.
        console.log('created env 2 & waiting');
        const env2 = await createVirtualEnvironment('second');
        await waitForInterpreterToBeDetected(env2);
    }).timeout(timeoutMs * 2);

    test('Detect a new Virtual Environment, and other workspace folder must not be affected (multiroot)', async function () {
        if (!IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        setTimeout(() => {
            console.error('About to fail test due to timeout');
        }, (timeoutMs * 2) - 30);
        // There should be nothing in workspacec4.
        let items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);

        const [env1, env2] = await Promise.all([createVirtualEnvironment('first3'), createVirtualEnvironment('second3')]);
        await Promise.all([waitForInterpreterToBeDetected(env1), waitForInterpreterToBeDetected(env2)]);

        // Workspace4 should still not have any interpreters.
        items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);
    }).timeout(timeoutMs * 2);
});
