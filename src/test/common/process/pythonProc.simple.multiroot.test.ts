// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { execFile } from 'child_process';
import { Container } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { ConfigurationTarget, Disposable, Uri } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { registerTypes as processRegisterTypes } from '../../../client/common/process/serviceRegistry';
import { IPythonExecutionFactory, StdErrError } from '../../../client/common/process/types';
import { IDisposableRegistry, IPathUtils, IsWindows } from '../../../client/common/types';
import { IS_WINDOWS } from '../../../client/common/utils';
import { registerTypes as variablesRegisterTypes } from '../../../client/common/variables/serviceRegistry';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { clearPythonPathInWorkspaceFolder, updateSetting } from '../../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

use(chaiAsPromised);

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = Uri.file(path.join(workspace4Path.fsPath, 'one.py'));

// tslint:disable-next-line:max-func-body-length
suite('PythonExecutableService', () => {
    let cont: Container;
    let serviceManager: ServiceManager;
    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initialize();
    });
    setup(() => {
        cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, []);
        serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
        serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        processRegisterTypes(serviceManager);
        variablesRegisterTypes(serviceManager);
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        cont.unbindAll();
        cont.unload();
        await closeActiveWindows();
        await clearPythonPathInWorkspaceFolder(workspace4Path);
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        await initializeTest();
    });

    test('Importing without a valid PYTHONPATH should fail', async () => {
        await updateSetting('envFile', 'someInvalidFile.env', workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const pythonExecFactory = serviceManager.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create(workspace4PyFile);
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], { cwd: path.dirname(workspace4PyFile.fsPath), throwOnStdErr: true });

        await expect(promise).to.eventually.be.rejectedWith(StdErrError);
    });

    test('Importing with a valid PYTHONPATH from .env file should succeed', async () => {
        await updateSetting('envFile', undefined, workspace4PyFile, ConfigurationTarget.WorkspaceFolder);
        const pythonExecFactory = serviceManager.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create(workspace4PyFile);
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], { cwd: path.dirname(workspace4PyFile.fsPath), throwOnStdErr: true });

        await expect(promise).to.eventually.have.property('stdout', `Hello${EOL}`);
    });

    test('Known modules such as \'os\' and \'sys\' should be deemed \'installed\'', async () => {
        const pythonExecFactory = serviceManager.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create(workspace4PyFile);
        const osModuleIsInstalled = pythonExecService.isModuleInstalled('os');
        const sysModuleIsInstalled = pythonExecService.isModuleInstalled('sys');
        await expect(osModuleIsInstalled).to.eventually.equal(true, 'os module is not installed');
        await expect(sysModuleIsInstalled).to.eventually.equal(true, 'sys module is not installed');
    });

    test('Unknown modules such as \'xyzabc123\' be deemed \'not installed\'', async () => {
        const pythonExecFactory = serviceManager.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create(workspace4PyFile);
        const randomModuleName = `xyz123${new Date().getSeconds()}`;
        const randomModuleIsInstalled = pythonExecService.isModuleInstalled(randomModuleName);
        await expect(randomModuleIsInstalled).to.eventually.equal(false, `Random module '${randomModuleName}' is installed`);
    });

    test('Value for \'python --version\' should be returned as version information', async () => {
        const pythonPath = PythonSettings.getInstance(workspace4Path).pythonPath;
        const expectedVersion = await new Promise<string>(resolve => {
            execFile(pythonPath, ['--version'], (error, stdout, stdErr) => {
                const out = (typeof stdErr === 'string' ? stdErr : '') + EOL + (typeof stdout === 'string' ? stdout : '');
                resolve(out.trim());
            });
        });
        const pythonExecFactory = serviceManager.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create(workspace4PyFile);
        const version = await pythonExecService.getVersion();
        expect(version).to.equal(expectedVersion, 'Versions are not the same');
    });

    test('Ensure correct path to executable is returned', async () => {
        const pythonPath = PythonSettings.getInstance(workspace4Path).pythonPath;
        const expectedExecutablePath = await new Promise<string>(resolve => {
            execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_error, stdout, _stdErr) => {
                resolve(stdout.trim());
            });
        });
        const pythonExecFactory = serviceManager.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecService = await pythonExecFactory.create(workspace4PyFile);
        const executablePath = await pythonExecService.getExecutablePath();
        expect(executablePath).to.equal(expectedExecutablePath, 'Executable paths are not the same');
    });
});
