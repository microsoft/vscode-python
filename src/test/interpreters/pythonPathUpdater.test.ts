import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { IPythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/types';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable:no-invalid-template-strings max-func-body-length

suite('Python Path Settings Updater', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let updaterServiceFactory: IPythonPathUpdaterServiceFactory;
    function setupMocks() {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        updaterServiceFactory = new PythonPathUpdaterServiceFactory(serviceContainer.object);
    }
    function setupConfigProvider(resource?: Uri): TypeMoq.IMock<WorkspaceConfiguration> {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService
            .setup(w => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(resource)))
            .returns(() => workspaceConfig.object);
        return workspaceConfig;
    }
    suite('Global', () => {
        setup(setupMocks);
        test('Python Path should not be updated when current pythonPath is the same', async () => {
            const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
            const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider();
            workspaceConfig
                .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                .returns(() => {
                    // tslint:disable-next-line:no-any
                    return { globalValue: pythonPath } as any;
                });

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                TypeMoq.Times.never()
            );
        });
        test('Python Path should be updated when current pythonPath is different', async () => {
            const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
            const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider();
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w =>
                    w.update(
                        TypeMoq.It.isValue('pythonPath'),
                        TypeMoq.It.isValue(pythonPath),
                        TypeMoq.It.isValue(true)
                    ),
                TypeMoq.Times.once()
            );
        });
    });

    suite('WorkspaceFolder', () => {
        setup(setupMocks);
        test('Python Path should not be updated when current pythonPath is the same', async () => {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig
                .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                .returns(() => {
                    // tslint:disable-next-line:no-any
                    return { workspaceFolderValue: pythonPath } as any;
                });

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                TypeMoq.Times.never()
            );
        });
        test('Python Path should be updated when current pythonPath is different', async () => {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w =>
                    w.update(
                        TypeMoq.It.isValue('pythonPath'),
                        TypeMoq.It.isValue(pythonPath),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder)
                    ),
                TypeMoq.Times.once()
            );
        });
        test('Python Path should be truncated for worspace-relative paths', async () => {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
            const pythonPath = Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
            const expectedPythonPath = path.join('env', 'bin', 'python');
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w =>
                    w.update(
                        TypeMoq.It.isValue('pythonPath'),
                        TypeMoq.It.isValue(expectedPythonPath),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder)
                    ),
                TypeMoq.Times.once()
            );
        });
    });
    suite('Workspace (multiroot scenario)', () => {
        setup(setupMocks);
        test('Python Path should not be updated when current pythonPath is the same', async () => {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig
                .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                .returns(() => {
                    // tslint:disable-next-line:no-any
                    return { workspaceValue: pythonPath } as any;
                });

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                TypeMoq.Times.never()
            );
        });
        test('Python Path should be updated when current pythonPath is different', async () => {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w =>
                    w.update(
                        TypeMoq.It.isValue('pythonPath'),
                        TypeMoq.It.isValue(pythonPath),
                        TypeMoq.It.isValue(false)
                    ),
                TypeMoq.Times.once()
            );
        });
        test('Python Path should be truncated for workspace-relative paths', async () => {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
            const pythonPath = Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
            const expectedPythonPath = path.join('env', 'bin', 'python');
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

            await updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(
                w =>
                    w.update(
                        TypeMoq.It.isValue('pythonPath'),
                        TypeMoq.It.isValue(expectedPythonPath),
                        TypeMoq.It.isValue(false)
                    ),
                TypeMoq.Times.once()
            );
        });
    });
});
