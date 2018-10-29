// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { sleep } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { IInterpreterLocatorService, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../../../client/interpreter/contracts';
import { getServiceContainer } from '../../../client/ioc';
import { isPythonVersionInProcess, PYTHON_PATH, rootWorkspaceUri } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';

suite('Interpreters - Workspace VirtualEnv Service', () => {
    const ioc = getServiceContainer();
    const firstEnvDir = path.join(rootWorkspaceUri.fsPath, '.venv1');
    const secondEnvDir = path.join(rootWorkspaceUri.fsPath, '.venv2');

    setup(async function () {
        if (!await isPythonVersionInProcess(undefined, '3') || IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        await createPythonEnvironment(firstEnvDir);
    });
    teardown(deletePythonEnvironments);

    async function createPythonEnvironment(envDir: string) {
        const envName = path.basename(envDir);
        spawnSync(PYTHON_PATH, ['-m', 'venv', envName], { cwd: rootWorkspaceUri.fsPath });
    }
    async function deletePythonEnvironments() {
        await sleep(1000);
        await fs.remove(firstEnvDir).catch(noop);
        await fs.remove(secondEnvDir).catch(noop);
    }
    async function waitForLocaInterpreterToBeDetected(locator: IInterpreterLocatorService, predicate: (item: PythonInterpreter) => boolean, predicateTitle: string) {
        // tslint:disable-next-line:prefer-array-literal
        for (const _ of new Array(30)) {
            const items = await locator.getInterpreters(rootWorkspaceUri);
            const identified = items.filter(predicate).length;
            if (identified > 0) {
                return;
            }
            await sleep(500);
        }
        throw new Error(`${predicateTitle}, Environments not detected in the workspacce ${rootWorkspaceUri.fsPath}`);
    }
    test('Environment Detection', async () => {
        const locator = ioc.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        // Ensure environment in our workspace folder is detected.
        const firstEnvName = path.basename(firstEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => !item.cachedEntry && item.envName === firstEnvName, 'Standard');

        // Create a new workspace virtual env, and ensure we return a cached list of environments.
        await createPythonEnvironment(secondEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => item.cachedEntry === true, 'Cached');

        // Ensure the new virtual env is also detected.
        const secondEnvName = path.basename(secondEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => !item.cachedEntry && item.envName === secondEnvName, 'New Environment');
    }).timeout(60000);
});
