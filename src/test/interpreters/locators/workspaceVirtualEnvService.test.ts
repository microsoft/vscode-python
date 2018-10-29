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
import { IServiceContainer } from '../../../client/ioc/types';
import { isPythonVersionInProcess, PYTHON_PATH, rootWorkspaceUri } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { initialize } from '../../initialize';

suite('Interpreters - Workspace VirtualEnv Service', () => {
    let serviceContainer: IServiceContainer;
    const envSuffix = + new Date().getTime().toString();
    const firstEnvDir = path.join(rootWorkspaceUri.fsPath, `.venv1${envSuffix}`);
    const secondEnvDir = path.join(rootWorkspaceUri.fsPath, `.venv2${envSuffix}`);

    suiteSetup(async function () {
        this.timeout(120_000);
        serviceContainer = (await initialize()).serviceContainer;
        if (!await isPythonVersionInProcess(undefined, '3') || IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        await deletePythonEnvironments();
    });
    setup(() => createPythonEnvironment(firstEnvDir));
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
    async function waitForLocaInterpreterToBeDetected(locator: IInterpreterLocatorService, predicate: (item: PythonInterpreter) => boolean, predicateTitle: string, expectedCount: number) {
        // tslint:disable-next-line:prefer-array-literal
        for (const _ of new Array(120)) {
            const items = await locator.getInterpreters(rootWorkspaceUri);
            const identified = items.filter(predicate).length;
            if (identified >= expectedCount) {
                return;
            }
            await sleep(500);
        }
        throw new Error(`${predicateTitle}, Environments not detected in the workspacce ${rootWorkspaceUri.fsPath}`);
    }
    test('Environment Detection', async () => {
        const locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        // Ensure environment in our workspace folder is detected.
        const firstEnvName = path.basename(firstEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => !item.cachedEntry && item.envName === firstEnvName, 'Standard', 1);
    }).timeout(120_000);

    test('Dynamic Environment Detection', async () => {
        const locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        // Ensure environment in our workspace folder is detected.
        const firstEnvName = path.basename(firstEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => !item.cachedEntry && item.envName === firstEnvName, 'Standard', 1);

        await createPythonEnvironment(secondEnvDir);

        // Ensure the new virtual env is also detected.
        const secondEnvName = path.basename(secondEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => !item.cachedEntry && item.envName === secondEnvName, 'Second Environment', 1);
    }).timeout(180_000);
});
