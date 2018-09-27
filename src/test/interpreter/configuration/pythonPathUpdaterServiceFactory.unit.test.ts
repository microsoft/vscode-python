import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { PythonPathUpdaterServiceFactory } from '../../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable:no-invalid-template-strings max-func-body-length

// This are more integration tests than "unit" tests.

suite('Python Path Settings Updater', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration>;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);

        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
    });

    test('Global', async () => {
        const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('python')))
            .returns(() => workspaceConfig.object);
        workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
            .returns(() => undefined);
        workspaceConfig.setup(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(ConfigurationTarget.Global)))
            .returns(() => Promise.resolve());

        const updaterServiceFactory = new PythonPathUpdaterServiceFactory(serviceContainer.object);
        const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
        await updater.updatePythonPath(pythonPath);

        serviceContainer.verifyAll();
        workspaceService.verifyAll();
        workspaceConfig.verifyAll();
    });

    test('Workspace', async () => {
        const workspaceFolderPath = path.join('user', 'desktop', 'development');
        const workspaceFolder = Uri.file(workspaceFolderPath);
        const pythonPath = `xWorkspacePythonPath${new Date().getMilliseconds()}`;
        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => workspaceConfig.object);
        workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
            .returns(() => undefined);
        workspaceConfig.setup(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(ConfigurationTarget.Workspace)))
            .returns(() => Promise.resolve());

        const updaterServiceFactory = new PythonPathUpdaterServiceFactory(serviceContainer.object);
        const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
        await updater.updatePythonPath(pythonPath);

        serviceContainer.verifyAll();
        workspaceService.verifyAll();
        workspaceConfig.verifyAll();
    });

    test('WorkspaceFolder', async () => {
        const workspaceFolderPath = path.join('user', 'desktop', 'development');
        const workspaceFolder = Uri.file(workspaceFolderPath);
        const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(workspaceFolder)))
            .returns(() => workspaceConfig.object);
        workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
            .returns(() => undefined);
        workspaceConfig.setup(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder)))
            .returns(() => Promise.resolve());

        const updaterServiceFactory = new PythonPathUpdaterServiceFactory(serviceContainer.object);
        const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
        await updater.updatePythonPath(pythonPath);

        serviceContainer.verifyAll();
        workspaceService.verifyAll();
        workspaceConfig.verifyAll();
    });
});
