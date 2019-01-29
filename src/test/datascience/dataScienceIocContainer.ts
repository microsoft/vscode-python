// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
//tslint:disable:trailing-comma
import * as child_process from 'child_process';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import {
    ConfigurationChangeEvent,
    Disposable,
    Event,
    EventEmitter,
    FileSystemWatcher,
    Uri,
    WorkspaceConfiguration,
    WorkspaceFolder
} from 'vscode';

import { TerminalManager } from '../../client/common/application/terminalManager';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ITerminalManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { PythonSettings } from '../../client/common/configSettings';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { RegistryImplementation } from '../../client/common/platform/registry';
import { IPlatformService, IRegistry } from '../../client/common/platform/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { IBufferDecoder, IProcessServiceFactory, IPythonExecutionFactory } from '../../client/common/process/types';
import { Bash } from '../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../client/common/terminal/environmentActivationProviders/commandPrompt';
import {
    CondaActivationCommandProvider
} from '../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import {
    PipEnvActivationCommandProvider
} from '../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import {
    PyEnvActivationCommandProvider
} from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalHelper } from '../../client/common/terminal/helper';
import {
    ITerminalActivationCommandProvider,
    ITerminalHelper,
    TerminalActivationProviders
} from '../../client/common/terminal/types';
import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    ICurrentProcess,
    ILogger,
    IPathUtils,
    IPersistentStateFactory,
    IsWindows
} from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { EnvironmentVariablesService } from '../../client/common/variables/environment';
import { SystemVariables } from '../../client/common/variables/systemVariables';
import { IEnvironmentVariablesProvider, IEnvironmentVariablesService } from '../../client/common/variables/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { History } from '../../client/datascience/history';
import { HistoryProvider } from '../../client/datascience/historyProvider';
import { JupyterCommandFactory } from '../../client/datascience/jupyter/jupyterCommand';
import { JupyterExecution } from '../../client/datascience/jupyter/jupyterExecution';
import { JupyterExporter } from '../../client/datascience/jupyter/jupyterExporter';
import { JupyterImporter } from '../../client/datascience/jupyter/jupyterImporter';
import { JupyterServer } from '../../client/datascience/jupyter/jupyterServer';
import { JupyterSessionManager } from '../../client/datascience/jupyter/jupyterSessionManager';
import { StatusProvider } from '../../client/datascience/statusProvider';
import {
    ICodeCssGenerator,
    IHistory,
    IHistoryProvider,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterSessionManager,
    INotebookExporter,
    INotebookImporter,
    INotebookServer,
    IStatusProvider
} from '../../client/datascience/types';
import { EnvironmentActivationService } from '../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IPythonPathUpdaterServiceFactory,
    IPythonPathUpdaterServiceManager
} from '../../client/interpreter/configuration/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    IInterpreterService,
    IInterpreterVersionService,
    IInterpreterWatcher,
    IInterpreterWatcherBuilder,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IPipEnvService,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../client/interpreter/contracts';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { PythonInterpreterLocatorService } from '../../client/interpreter/locators';
import { InterpreterLocatorHelper } from '../../client/interpreter/locators/helpers';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/interpreter/locators/services/condaEnvService';
import {
    CurrentPathService,
    PythonInPathCommandProvider
} from '../../client/interpreter/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService
} from '../../client/interpreter/locators/services/globalVirtualEnvService';
import { InterpreterWatcherBuilder } from '../../client/interpreter/locators/services/interpreterWatcherBuilder';
import {
    KnownPathsService,
    KnownSearchPathsForInterpreters
} from '../../client/interpreter/locators/services/KnownPathsService';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../../client/interpreter/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from '../../client/interpreter/locators/services/windowsRegistryService';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService
} from '../../client/interpreter/locators/services/workspaceVirtualEnvService';
import {
    WorkspaceVirtualEnvWatcherService
} from '../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../../client/interpreter/locators/types';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { MockCommandManager } from './mockCommandManager';
import { MockJupyterManager } from './mockJupyterManager';

export class DataScienceIocContainer extends UnitTestIocContainer {

    private pythonSettings = new class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    }(undefined, new MockAutoSelectionService());
    private commandManager: MockCommandManager = new MockCommandManager();
    private setContexts: Record<string, boolean> = {};
    private contextSetEvent: EventEmitter<{ name: string; value: boolean }> = new EventEmitter<{ name: string; value: boolean }>();
    private jupyterMock: MockJupyterManager | undefined;
    private shouldMockJupyter: boolean;
    private asyncRegistry: AsyncDisposableRegistry;
    private configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();

    constructor() {
        super();
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        this.shouldMockJupyter = !isRollingBuild;
        this.asyncRegistry = new AsyncDisposableRegistry();
    }

    public get onContextSet(): Event<{ name: string; value: boolean }> {
        return this.contextSetEvent.event;
    }

    public async dispose(): Promise<void> {
        await this.asyncRegistry.dispose();
        await super.dispose();
    }

    //tslint:disable:max-func-body-length
    public registerDataScienceTypes() {
        this.registerFileSystemTypes();
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecution);
        this.serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
        this.serviceManager.add<IHistory>(IHistory, History);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServer);
        this.serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
        this.serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
        this.serviceManager.add<IKnownSearchPathsForInterpreters>(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters);
        this.serviceManager.addSingletonInstance<IAsyncDisposableRegistry>(IAsyncDisposableRegistry, this.asyncRegistry);
        this.serviceManager.addSingleton<IPythonInPathCommandProvider>(IPythonInPathCommandProvider, PythonInPathCommandProvider);
        this.serviceManager.addSingleton<IEnvironmentActivationService>(IEnvironmentActivationService, EnvironmentActivationService);

        this.serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, Bash, TerminalActivationProviders.bashCShellFish);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, CommandPromptAndPowerShell, TerminalActivationProviders.commandPromptAndPowerShell);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, PyEnvActivationCommandProvider, TerminalActivationProviders.pyenv);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, CondaActivationCommandProvider, TerminalActivationProviders.conda);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, PipEnvActivationCommandProvider, TerminalActivationProviders.pipenv);
        this.serviceManager.addSingleton<ITerminalManager>(ITerminalManager, TerminalManager);
        this.serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);

        // Setup our command list
        this.commandManager.registerCommand('setContext', (name: string, value: boolean) => {
            this.setContexts[name] = value;
            this.contextSetEvent.fire({ name: name, value: value });
        });
        this.serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, this.commandManager);

        // Also setup a mock execution service and interpreter service
        const logger = TypeMoq.Mock.ofType<ILogger>();
        const condaService = TypeMoq.Mock.ofType<ICondaService>();
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        const interpreterDisplay = TypeMoq.Mock.ofType<IInterpreterDisplay>();

        // Setup default settings
        this.pythonSettings.datascience = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 20000,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true,
            maxOutputSize: 400,
            sendSelectionToInteractiveWindow: false,
            codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
            markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)'
        };

        const workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration> = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceConfig.setup(ws => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => false);
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString()))
            .returns(() => undefined);
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((s, d) => d);

        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => this.pythonSettings);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(w => w.onDidChangeConfiguration).returns(() => this.configChangeEvent.event);
        interpreterDisplay.setup(i => i.refresh(TypeMoq.It.isAny())).returns(() => Promise.resolve());

        class MockFileSystemWatcher implements FileSystemWatcher {
            public ignoreCreateEvents: boolean = false;
            public ignoreChangeEvents: boolean = false;
            public ignoreDeleteEvents: boolean = false;
            //tslint:disable-next-line:no-any
            public onDidChange(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            //tslint:disable-next-line:no-any
            public onDidDelete(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            //tslint:disable-next-line:no-any
            public onDidCreate(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            public dispose() {
                noop();
            }
        }
        workspaceService.setup(w => w.createFileSystemWatcher(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return new MockFileSystemWatcher();
        });
        workspaceService
            .setup(w => w.hasWorkspaceFolders)
            .returns(() => true);
        const testWorkspaceFolder = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
        const workspaceFolder = this.createMoqWorkspaceFolder(testWorkspaceFolder);
        workspaceService
            .setup(w => w.workspaceFolders)
            .returns(() => [workspaceFolder]);
        workspaceService.setup(w => w.rootPath).returns(() => '~');

        const systemVariables: SystemVariables = new SystemVariables(undefined);
        const env = { ...systemVariables };

        // Look on the path for python
        const pythonPath = this.findPythonPath();

        this.pythonSettings.pythonPath = pythonPath;
        const folders = ['Envs', '.virtualenvs'];
        this.pythonSettings.venvFolders = folders;
        this.pythonSettings.venvPath = path.join('~', 'foo');
        this.pythonSettings.terminal = {
            executeInFileDir: false,
            launchArgs: [],
            activateEnvironment: true
        };

        condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(false));
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => undefined);

        const envVarsProvider: TypeMoq.IMock<IEnvironmentVariablesProvider> = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve(env));
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global');
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace');
        this.serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);

        this.serviceManager.addSingletonInstance<ILogger>(ILogger, logger.object);
        this.serviceManager.addSingletonInstance<ICondaService>(ICondaService, condaService.object);
        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        this.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, documentManager.object);
        this.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);
        this.serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configurationService.object);
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        this.serviceManager.addSingleton<IEnvironmentVariablesService>(IEnvironmentVariablesService, EnvironmentVariablesService);
        this.serviceManager.addSingletonInstance<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider, envVarsProvider.object);
        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        this.serviceManager.add<IInterpreterWatcher>(IInterpreterWatcher, WorkspaceVirtualEnvWatcherService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);

        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IPipEnvService, PipEnvService);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);

        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);

        this.serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
        this.serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
        this.serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);
        this.serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
        this.serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        this.serviceManager.addSingletonInstance<IInterpreterDisplay>(IInterpreterDisplay, interpreterDisplay.object);

        this.serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory);
        this.serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, PythonPathUpdaterService);

        const currentProcess = new CurrentProcess();
        this.serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, currentProcess);

        // Create our jupyter mock if necessary
        if (this.shouldMockJupyter) {
            this.jupyterMock = new MockJupyterManager(this.serviceManager);
        } else {
            this.serviceManager.addSingleton<IProcessServiceFactory>(IProcessServiceFactory, ProcessServiceFactory);
            this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
            this.serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
            this.serviceManager.addSingleton<IJupyterSessionManager>(IJupyterSessionManager, JupyterSessionManager);
        }

        if (this.serviceManager.get<IPlatformService>(IPlatformService).isWindows) {
            this.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
        }

        const dummyDisposable = {
            dispose: () => { return; }
        };

        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(Uri.file('')));
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);

        // tslint:disable-next-line:no-empty no-console
        logger.setup(l => l.logInformation(TypeMoq.It.isAny())).returns((m) => console.log(m));

        const interpreterManager = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        interpreterManager.initialize();
    }

    public createMoqWorkspaceFolder(folderPath: string) {
        const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
        folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
        return folder.object;
    }

    public getContext(name: string): boolean {
        if (this.setContexts.hasOwnProperty(name)) {
            return this.setContexts[name];
        }

        return false;
    }

    public getSettings() {
        return this.pythonSettings;
    }

    public forceSettingsChanged(newPath: string) {
        this.pythonSettings.pythonPath = newPath;
        this.pythonSettings.fireChangeEvent();
        this.configChangeEvent.fire({
            affectsConfiguration(s: string, r?: Uri) : boolean {
                return true;
            }
        });
    }

    public get mockJupyter(): MockJupyterManager | undefined {
        return this.jupyterMock;
    }

    private findPythonPath(): string {
        try {
            const output = child_process.execFileSync('python', ['-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' });
            return output.replace(/\r?\n/g, '');
        } catch (ex) {
            return 'python';
        }
    }
}
