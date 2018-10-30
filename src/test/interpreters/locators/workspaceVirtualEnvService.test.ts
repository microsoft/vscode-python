// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
import { expect } from 'chai';
import { spawn } from 'child_process';
import * as path from 'path';
import { Uri } from 'vscode';
import { sleep } from '../../../client/common/utils/async';
import { IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { deleteFiles, isPythonVersionInProcess, PYTHON_PATH, rootWorkspaceUri } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { initialize, multirootPath } from '../../initialize';

const timeoutSecs = 120;
suite('Interpreters - Workspace VirtualEnv Service', function () {
    this.timeout(timeoutSecs * 1000);
    this.retries(0);

    let locator: IInterpreterLocatorService;
    const workspaceUri = IS_MULTI_ROOT_TEST ? Uri.file(path.join(multirootPath, 'workspace3')) : rootWorkspaceUri;
    const workspace4 = Uri.file(path.join(multirootPath, 'workspace4'));
    const venvPrefix = '.venv';
    let serviceContainer: IServiceContainer;

    async function waitForInterpreterToBeDetected(envNameToLookFor: string) {
        for (let i = 0; i < timeoutSecs; i += 1) {
            const items = await locator.getInterpreters(workspaceUri);
            if (items.some(item => item.envName === envNameToLookFor && !item.cachedEntry)) {
                return;
            }
            await sleep(500);
        }
        throw new Error(`${envNameToLookFor}, Environment not detected in the workspace ${workspaceUri.fsPath}`);
    }
    async function createVirtualEnvironment(envSuffix: string) {
        // Ensure env is random to avoid conflicts in tests (currupting test data).
        const envName = `${venvPrefix}${envSuffix}${new Date().getTime().toString()}`;
        return new Promise<string>((resolve, reject) => {
            const proc = spawn(PYTHON_PATH, ['-m', 'venv', envName], { cwd: workspaceUri.fsPath });
            let stdErr = '';
            proc.stderr.on('data', data => stdErr += data.toString());
            proc.on('exit', () => {
                if (stdErr.length === 0) {
                    return resolve(envName);
                }
                const err = new Error(`Failed to create Env ${envName}, ${PYTHON_PATH}, Error: ${stdErr.toString()}`);
                reject(err);
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

    test('Detect a new Virtual Environment, and other workspace folder must not be affected (multiroot)', async function () {
        if (!IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        // There should be nothing in workspacec4.
        let items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);

        const [env1, env2] = await Promise.all([createVirtualEnvironment('first3'), createVirtualEnvironment('second3')]);
        await Promise.all([waitForInterpreterToBeDetected(env1), waitForInterpreterToBeDetected(env2)]);

        // Workspace4 should still not have any interpreters.
        items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);
    });
});
