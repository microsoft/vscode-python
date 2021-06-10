import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IExperimentService, IInterpreterPathService } from '../../client/common/types';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { IPythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Python Path Settings Updater', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let experimentsManager: TypeMoq.IMock<IExperimentService>;
    let interpreterPathService: TypeMoq.IMock<IInterpreterPathService>;
    let updaterServiceFactory: IPythonPathUpdaterServiceFactory;
    function setupMocks(inExperiment: boolean = false) {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        experimentsManager = TypeMoq.Mock.ofType<IExperimentService>();
        experimentsManager.setup((e) => e.inExperimentSync(TypeMoq.It.isAny())).returns(() => inExperiment);
        interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentsManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterPathService)))
            .returns(() => interpreterPathService.object);
        updaterServiceFactory = new PythonPathUpdaterServiceFactory(serviceContainer.object);
    }
    function setupConfigProvider(resource?: Uri): TypeMoq.IMock<WorkspaceConfiguration> {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService
            .setup((w) => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(resource)))
            .returns(() => workspaceConfig.object);
        return workspaceConfig;
    }

    suite('When not in Deprecate PythonPath experiment', async () => {
        suite('Global', () => {
            setup(() => setupMocks(false));
            test('Python Path should not be updated when current pythonPath is the same', async () => {
                const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
                const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
                const workspaceConfig = setupConfigProvider();
                workspaceConfig
                    .setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => {
                        return { globalValue: pythonPath } as any;
                    });

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                    TypeMoq.Times.never(),
                );
            });
            test('Python Path should be updated when current pythonPath is different', async () => {
                const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
                const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
                const workspaceConfig = setupConfigProvider();
                workspaceConfig.setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) =>
                        w.update(
                            TypeMoq.It.isValue('pythonPath'),
                            TypeMoq.It.isValue(pythonPath),
                            TypeMoq.It.isValue(true),
                        ),
                    TypeMoq.Times.once(),
                );
            });
        });

        suite('WorkspaceFolder', () => {
            setup(() => setupMocks(false));
            test('Python Path should not be updated when current pythonPath is the same', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig
                    .setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => {
                        return { workspaceFolderValue: pythonPath } as any;
                    });

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                    TypeMoq.Times.never(),
                );
            });
            test('Python Path should be updated when current pythonPath is different', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig.setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) =>
                        w.update(
                            TypeMoq.It.isValue('pythonPath'),
                            TypeMoq.It.isValue(pythonPath),
                            TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        ),
                    TypeMoq.Times.once(),
                );
            });
            test('Python Path should be truncated for worspace-relative paths', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
                const pythonPath = Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
                const expectedPythonPath = path.join('env', 'bin', 'python');
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig.setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) =>
                        w.update(
                            TypeMoq.It.isValue('pythonPath'),
                            TypeMoq.It.isValue(expectedPythonPath),
                            TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        ),
                    TypeMoq.Times.once(),
                );
            });
        });
        suite('Workspace (multiroot scenario)', () => {
            setup(() => setupMocks(false));
            test('Python Path should not be updated when current pythonPath is the same', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig
                    .setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => {
                        return { workspaceValue: pythonPath } as any;
                    });

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                    TypeMoq.Times.never(),
                );
            });
            test('Python Path should be updated when current pythonPath is different', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig.setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) =>
                        w.update(
                            TypeMoq.It.isValue('pythonPath'),
                            TypeMoq.It.isValue(pythonPath),
                            TypeMoq.It.isValue(false),
                        ),
                    TypeMoq.Times.once(),
                );
            });
            test('Python Path should be truncated for workspace-relative paths', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
                const pythonPath = Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
                const expectedPythonPath = path.join('env', 'bin', 'python');
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig.setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);

                await updater.updatePythonPath(pythonPath);
                workspaceConfig.verify(
                    (w) =>
                        w.update(
                            TypeMoq.It.isValue('pythonPath'),
                            TypeMoq.It.isValue(expectedPythonPath),
                            TypeMoq.It.isValue(false),
                        ),
                    TypeMoq.Times.once(),
                );
            });
        });
    });

    suite('When in Deprecate PythonPath experiment', async () => {
        suite('Global', () => {
            setup(() => setupMocks(true));
            test('Python Path should not be updated when current pythonPath is the same', async () => {
                const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
                interpreterPathService
                    .setup((i) => i.inspect(undefined))
                    .returns(() => {
                        return { globalValue: pythonPath };
                    });
                interpreterPathService
                    .setup((i) => i.update(undefined, ConfigurationTarget.Global, pythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.never());

                const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
                await updater.updatePythonPath(pythonPath);
                interpreterPathService.verifyAll();
            });
            test('Python Path should be updated when current pythonPath is different', async () => {
                const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
                interpreterPathService.setup((i) => i.inspect(undefined)).returns(() => ({}));

                interpreterPathService
                    .setup((i) => i.update(undefined, ConfigurationTarget.Global, pythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());
                const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
                await updater.updatePythonPath(pythonPath);
                interpreterPathService.verifyAll();
            });
        });

        suite('WorkspaceFolder', () => {
            setup(() => setupMocks(true));
            test('Python Path should not be updated when current pythonPath is the same', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                interpreterPathService
                    .setup((i) => i.inspect(workspaceFolder))
                    .returns(() => ({
                        workspaceFolderValue: pythonPath,
                    }));
                interpreterPathService
                    .setup((i) => i.update(workspaceFolder, ConfigurationTarget.WorkspaceFolder, pythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.never());
                const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
                await updater.updatePythonPath(pythonPath);
                interpreterPathService.verifyAll();
            });
            test('Python Path should be updated when current pythonPath is different', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                interpreterPathService.setup((i) => i.inspect(workspaceFolder)).returns(() => ({}));
                interpreterPathService
                    .setup((i) => i.update(workspaceFolder, ConfigurationTarget.WorkspaceFolder, pythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());

                const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
                await updater.updatePythonPath(pythonPath);
                interpreterPathService.verifyAll();
            });
            test('Python Path should be truncated for workspace-relative paths', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const pythonPath = Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
                const expectedPythonPath = path.join('env', 'bin', 'python');
                const workspaceConfig = setupConfigProvider(workspaceFolder);
                workspaceConfig.setup((w) => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);
                interpreterPathService.setup((i) => i.inspect(workspaceFolder)).returns(() => ({}));
                interpreterPathService
                    .setup((i) => i.update(workspaceFolder, ConfigurationTarget.WorkspaceFolder, expectedPythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());

                const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
                await updater.updatePythonPath(pythonPath);
                interpreterPathService.verifyAll();
            });
        });
        suite('Workspace (multiroot scenario)', () => {
            setup(() => setupMocks(true));
            test('Python Path should not be updated when current pythonPath is the same', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
                interpreterPathService
                    .setup((i) => i.inspect(workspaceFolder))
                    .returns(() => ({ workspaceValue: pythonPath }));
                interpreterPathService
                    .setup((i) => i.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.never());

                const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
                await updater.updatePythonPath(pythonPath);
                interpreterPathService.verifyAll();
            });
            test('Python Path should be updated when current pythonPath is different', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;

                interpreterPathService.setup((i) => i.inspect(workspaceFolder)).returns(() => ({}));
                interpreterPathService
                    .setup((i) => i.update(workspaceFolder, ConfigurationTarget.Workspace, pythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());

                const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
                await updater.updatePythonPath(pythonPath);

                interpreterPathService.verifyAll();
            });
            test('Python Path should be truncated for workspace-relative paths', async () => {
                const workspaceFolderPath = path.join('user', 'desktop', 'development');
                const workspaceFolder = Uri.file(workspaceFolderPath);
                const pythonPath = Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
                const expectedPythonPath = path.join('env', 'bin', 'python');

                interpreterPathService.setup((i) => i.inspect(workspaceFolder)).returns(() => ({}));
                interpreterPathService
                    .setup((i) => i.update(workspaceFolder, ConfigurationTarget.Workspace, expectedPythonPath))
                    .returns(() => Promise.resolve())
                    .verifiable(TypeMoq.Times.once());

                const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
                await updater.updatePythonPath(pythonPath);

                interpreterPathService.verifyAll();
            });
        });
    });
});
