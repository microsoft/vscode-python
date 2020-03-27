// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { execFile } from 'child_process';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IPythonExecutionFactory, StdErrError } from '../../../client/common/process/types';
import { IConfigurationService } from '../../../client/common/types';
import { clearCache } from '../../../client/common/utils/cacheUtils';
import { OSType } from '../../../client/common/utils/platform';
import { IServiceContainer } from '../../../client/ioc/types';
import { clearPythonPathInWorkspaceFolder, getExtensionSettings, isOs, isPythonVersion } from '../../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

use(chaiAsPromised);

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = Uri.file(path.join(workspace4Path.fsPath, 'one.py'));

// tslint:disable-next-line:max-func-body-length
suite('PythonExecutableService', () => {
    let serviceContainer: IServiceContainer;
    let configService: IConfigurationService;
    let pythonExecFactory: IPythonExecutionFactory;

    suiteSetup(async function() {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        serviceContainer = (await initialize()).serviceContainer;
    });
    setup(async () => {
        configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);

        await configService.updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        clearCache();
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await configService.updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initializeTest();
        clearCache();
    });

    test('Importing without a valid PYTHONPATH should fail', async () => {
        await configService.updateSetting(
            'envFile',
            'someInvalidFile.env',
            workspace4PyFile,
            ConfigurationTarget.WorkspaceFolder
        );
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], {
            cwd: path.dirname(workspace4PyFile.fsPath),
            throwOnStdErr: true
        });

        await expect(promise).to.eventually.be.rejectedWith(StdErrError);
    });

    test('Importing with a valid PYTHONPATH from .env file should succeed', async function() {
        // This test has not been working for many months in Python 2.7 under
        // Windows. Tracked by #2547.
        if (isOs(OSType.Windows) && (await isPythonVersion('2.7'))) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }

        await configService.updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], {
            cwd: path.dirname(workspace4PyFile.fsPath),
            throwOnStdErr: true
        });

        await expect(promise).to.eventually.have.property('stdout', `Hello${EOL}`);
    });

    test("Known modules such as 'os' and 'sys' should be deemed 'installed'", async () => {
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const osModuleIsInstalled = pythonExecService.isModuleInstalled('os');
        const sysModuleIsInstalled = pythonExecService.isModuleInstalled('sys');
        await expect(osModuleIsInstalled).to.eventually.equal(true, 'os module is not installed');
        await expect(sysModuleIsInstalled).to.eventually.equal(true, 'sys module is not installed');
    });

    test("Unknown modules such as 'xyzabc123' be deemed 'not installed'", async () => {
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const randomModuleName = `xyz123${new Date().getSeconds()}`;
        const randomModuleIsInstalled = pythonExecService.isModuleInstalled(randomModuleName);
        await expect(randomModuleIsInstalled).to.eventually.equal(
            false,
            `Random module '${randomModuleName}' is installed`
        );
    });

    test('Ensure correct path to executable is returned', async () => {
        const pythonPath = getExtensionSettings(workspace4Path).pythonPath;
        let expectedExecutablePath: string;
        if (await fs.pathExists(pythonPath)) {
            expectedExecutablePath = pythonPath;
        } else {
            expectedExecutablePath = await new Promise<string>(resolve => {
                execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_error, stdout, _stdErr) => {
                    resolve(stdout.trim());
                });
            });
        }
        const pythonExecService = await pythonExecFactory.create({ resource: workspace4PyFile });
        const executablePath = await pythonExecService.getExecutablePath();
        expect(executablePath).to.equal(expectedExecutablePath, 'Executable paths are not the same');
    });
});
