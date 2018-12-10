// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
//tslint:disable:trailing-comma
import * as child_process from 'child_process';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, FileSystemWatcher, Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService
} from '../../client/common/application/types';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { PythonSettings } from '../../client/common/configSettings';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IS_64_BIT, IS_WINDOWS } from '../../client/common/platform/constants';
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
    PyEnvActivationCommandProvider,
} from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { ITerminalActivationCommandProvider } from '../../client/common/terminal/types';
import {
    IAsyncDisposableRegistry,
    IConfigurationService,
    ICurrentProcess,
    ILogger,
    IPathUtils,
    IPersistentStateFactory,
    Is64Bit,
    IsWindows
} from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { EnvironmentVariablesService } from '../../client/common/variables/environment';
import { SystemVariables } from '../../client/common/variables/systemVariables';
import { IEnvironmentVariablesProvider, IEnvironmentVariablesService } from '../../client/common/variables/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { History } from '../../client/datascience/history';
import { HistoryProvider } from '../../client/datascience/historyProvider';
import { JupyterExecution } from '../../client/datascience/jupyterExecution';
import { JupyterExporter } from '../../client/datascience/jupyterExporter';
import { JupyterImporter } from '../../client/datascience/jupyterImporter';
import { JupyterServer } from '../../client/datascience/jupyterServer';
import { StatusProvider } from '../../client/datascience/statusProvider';
import {
    ICodeCssGenerator,
    IHistory,
    IHistoryProvider,
    IJupyterExecution,
    INotebookExporter,
    INotebookImporter,
    INotebookServer,
    IStatusProvider
} from '../../client/datascience/types';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IPythonPathUpdaterServiceFactory,
    IPythonPathUpdaterServiceManager,
} from '../../client/interpreter/configuration/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
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
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../client/interpreter/contracts';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { PythonInterpreterLocatorService } from '../../client/interpreter/locators';
import { InterpreterLocatorHelper } from '../../client/interpreter/locators/helpers';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/interpreter/locators/services/condaEnvService';
import { CurrentPathService } from '../../client/interpreter/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService,
} from '../../client/interpreter/locators/services/globalVirtualEnvService';
import { InterpreterWatcherBuilder } from '../../client/interpreter/locators/services/interpreterWatcherBuilder';
import {
    KnownPathsService,
    KnownSearchPathsForInterpreters,
} from '../../client/interpreter/locators/services/KnownPathsService';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { WindowsRegistryService } from '../../client/interpreter/locators/services/windowsRegistryService';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService,
} from '../../client/interpreter/locators/services/workspaceVirtualEnvService';
import {
    WorkspaceVirtualEnvWatcherService,
} from '../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { MockCommandManager } from './mockCommandManager';

export class DataScienceIocContainer extends UnitTestIocContainer {

    private commandManager : MockCommandManager = new MockCommandManager();
    private setContexts : { [name: string] : boolean } = {};

    constructor() {
        super();
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
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
        this.serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
        this.serviceManager.add<IKnownSearchPathsForInterpreters>(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters);
        this.serviceManager.addSingleton<IAsyncDisposableRegistry>(IAsyncDisposableRegistry, AsyncDisposableRegistry);

        // Setup our command list
        this.commandManager.registerCommand('setContext', (name: string, value: boolean) => {
            this.setContexts[name] = value;
        });
        this.serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, this.commandManager);

        // Also setup a mock execution service and interpreter service
        const logger = TypeMoq.Mock.ofType<ILogger>();
        const condaService = TypeMoq.Mock.ofType<ICondaService>();
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        const currentProcess = new CurrentProcess();
        const pythonSettings = new PythonSettings();

        // Setup default settings
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 60000,
            enabled: true,
            jupyterServerURI: 'local',
            notebookFileRoot: 'WORKSPACE',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true
        };

        const workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration> = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceConfig.setup(ws => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => false);
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString()))
            .returns(() => undefined);
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((s, d) => d);
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
        const env = {...systemVariables};

        // Look on the path for python
        const pythonPath = this.findPythonPath();

        pythonSettings.pythonPath = pythonPath;
        const folders = ['Envs', '.virtualenvs'];
        pythonSettings.venvFolders = folders;
        pythonSettings.venvPath = path.join('~', 'foo');

        condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(false));
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => undefined);

        const envVarsProvider: TypeMoq.IMock<IEnvironmentVariablesProvider> = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve(env));
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global');
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace');
        this.serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);

        this.serviceManager.addSingletonInstance<ILogger>(ILogger, logger.object);
        this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
        this.serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
        this.serviceManager.addSingletonInstance<ICondaService>(ICondaService, condaService.object);
        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        this.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, documentManager.object);
        this.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);
        this.serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configurationService.object);
        this.serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, currentProcess);
        this.serviceManager.addSingleton<IProcessServiceFactory>(IProcessServiceFactory, ProcessServiceFactory);
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        this.serviceManager.addSingleton<IEnvironmentVariablesService>(IEnvironmentVariablesService, EnvironmentVariablesService);
        this.serviceManager.addSingletonInstance<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider, envVarsProvider.object);
        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
        this.serviceManager.addSingletonInstance<boolean>(Is64Bit, IS_64_BIT);

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

        const isWindows = this.serviceManager.get<boolean>(IsWindows);
        if (isWindows) {
            this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);
        }
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);

        this.serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
        this.serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
        this.serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);
        this.serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
        this.serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);

        this.serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory);
        this.serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, PythonPathUpdaterService);

        if (this.serviceManager.get<IPlatformService>(IPlatformService).isWindows) {
            this.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
        }
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, Bash, 'bashCShellFish');
            this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, CommandPromptAndPowerShell, 'commandPromptAndPowerShell');
            this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider, PyEnvActivationCommandProvider, 'pyenv');

        const dummyDisposable = {
            dispose: () => { return; }
        };

        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(Uri.file('')));
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);

        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => workspaceConfig.object);

        // tslint:disable-next-line:no-empty
        logger.setup(l => l.logInformation(TypeMoq.It.isAny())).returns((m) => {}); // console.log(m)); // REnable this to debug the server
    }

    public createMoqWorkspaceFolder(folderPath: string) {
        const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
        folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
        return folder.object;
    }

    public getContext(name: string) : boolean {
        if (this.setContexts.hasOwnProperty(name)) {
            return this.setContexts[name];
        }

        return false;
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
