// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
import * as fs from 'fs-extra';
import * as path from 'path';
import { getVirtualEnvBinName } from '../../../client/common/platform/osinfo';
import { PlatformService } from '../../../client/common/platform/platformService';
import { sleep } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { IInterpreterLocatorService, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { PYTHON_PATH, rootWorkspaceUri } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { initialize } from '../../initialize';

suite('Interpreters - Workspace VirtualEnv Service', () => {

    let serviceContainer: IServiceContainer;
    const envSuffix = + new Date().getTime().toString();
    const firstEnvDir = path.join(rootWorkspaceUri.fsPath, `.venv1${envSuffix}`);
    const secondEnvDir = path.join(rootWorkspaceUri.fsPath, `.venv2${envSuffix}`);

    suiteSetup(async function () {
        if (IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        this.timeout(60_000);
        serviceContainer = (await initialize()).serviceContainer;
        await deletePythonEnvironments();
    });
    setup(() => createPythonEnvironment(firstEnvDir));
    teardown(deletePythonEnvironments);

    async function createPythonEnvironment(envDir: string) {
        const executable = path.basename(PYTHON_PATH);
        const scriptsBinDir = getVirtualEnvBinName(new PlatformService().info);
        await fs.ensureDir(path.join(envDir, scriptsBinDir));
        await new Promise((resolve, reject) => fs.copyFile(PYTHON_PATH, path.join(envDir, scriptsBinDir, executable),
            (ex) => ex ? reject(ex) : resolve()));
    }
    async function deletePythonEnvironments() {
        await fs.remove(firstEnvDir).catch(noop);
        await fs.remove(secondEnvDir).catch(noop);
    }
    async function waitForLocaInterpreterToBeDetected(locator: IInterpreterLocatorService, predicate: (item: PythonInterpreter) => boolean, predicateTitle: string) {
        // tslint:disable-next-line:prefer-array-literal
        for (const _ of new Array(60)) {
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
        const locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        // Ensure environment in our workspace folder is detected.
        const firstEnvName = path.basename(firstEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => item.envName === firstEnvName, 'Standard');
    });

    test('Dynamic Environment Detection', async () => {
        const locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        // Ensure environment in our workspace folder is detected.
        const firstEnvName = path.basename(firstEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => item.envName === firstEnvName, 'Standard');

        await createPythonEnvironment(secondEnvDir);

        // Ensure the new virtual env is also detected.
        const secondEnvName = path.basename(secondEnvDir);
        await waitForLocaInterpreterToBeDetected(locator, item => item.envName === secondEnvName, 'Second Environment');
    });
});
