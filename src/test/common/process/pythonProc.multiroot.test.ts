import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs-extra';
import { Container } from 'inversify';
import { EOL } from 'os';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Disposable, Uri } from 'vscode';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessService } from '../../../client/common/process/proc';
import { registerTypes as processRegisterTypes } from '../../../client/common/process/serviceRegistry';
import { IPythonExecutionFactory, StdErrError } from '../../../client/common/process/types';
import { IDiposableRegistry, IsWindows } from '../../../client/common/types';
import { IS_WINDOWS } from '../../../client/common/utils';
import { registerTypes as variablesRegisterTypes } from '../../../client/common/variables/serviceRegistry';
import { ServiceContainer } from '../../../client/ioc/container';
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
    let serviceContainer: ServiceContainer;
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
        serviceContainer = new ServiceContainer(cont);
        serviceManager.addSingletonInstance<Disposable[]>(IDiposableRegistry, []);
        serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
        processRegisterTypes(serviceManager);
        variablesRegisterTypes(serviceManager);
        return initializeTest();
    });
    suiteTeardown(() => {
        cont.unbindAll();
        cont.unload();
        return closeActiveWindows();
    });
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
});
