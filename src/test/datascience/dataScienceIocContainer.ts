// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as child_process from 'child_process';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import { Event, EventEmitter, Uri, WorkspaceConfiguration, FileSystemWatcher, Disposable } from 'vscode';

import { IApplicationShell, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { IProcessServiceFactory, IPythonExecutionFactory, IBufferDecoder } from '../../client/common/process/types';
import { IConfigurationService, ICurrentProcess, ILogger, IPythonSettings, IPathUtils, IsWindows, Is64Bit, IPersistentStateFactory } from '../../client/common/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { History } from '../../client/datascience/history';
import { HistoryProvider } from '../../client/datascience/historyProvider';
import { JupyterExecution } from '../../client/datascience/jupyterExecution';
import { JupyterImporter } from '../../client/datascience/jupyterImporter';
import { JupyterServer } from '../../client/datascience/jupyterServer';
import { StatusProvider } from '../../client/datascience/statusProvider';
import {
    ICodeCssGenerator,
    IHistory,
    IHistoryProvider,
    IJupyterExecution,
    INotebookImporter,
    INotebookServer,
    IStatusProvider
} from '../../client/datascience/types';
import { ICondaService, IInterpreterService, IKnownSearchPathsForInterpreters, IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE, IInterpreterHelper, IInterpreterLocatorHelper, IInterpreterVersionService, CONDA_ENV_FILE_SERVICE, CONDA_ENV_SERVICE, CURRENT_PATH_SERVICE, GLOBAL_VIRTUAL_ENV_SERVICE, WORKSPACE_VIRTUAL_ENV_SERVICE, PIPENV_SERVICE, WINDOWS_REGISTRY_SERVICE, KNOWN_PATH_SERVICE, IVirtualEnvironmentsSearchPathProvider, IPipEnvService, IInterpreterWatcher, IInterpreterWatcherBuilder } from '../../client/interpreter/contracts';
import { KnownSearchPathsForInterpreters, KnownPathsService } from '../../client/interpreter/locators/services/KnownPathsService';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { MockPythonExecutionService } from './executionServiceMock';
import { IEnvironmentVariablesService, IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { EnvironmentVariablesService } from '../../client/common/variables/environment';
import { EnvironmentVariablesProvider } from '../../client/common/variables/environmentVariablesProvider';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { IS_64_BIT, IS_WINDOWS } from '../../client/common/platform/constants';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { PythonInterpreterLocatorService } from '../../client/interpreter/locators';
import { IInterpreterComparer, IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterLocatorHelper } from '../../client/interpreter/locators/helpers';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { BufferDecoder } from '../../client/common/process/decoder';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/interpreter/locators/services/condaEnvService';
import { CurrentPathService } from '../../client/interpreter/locators/services/currentPathService';
import { GlobalVirtualEnvService, GlobalVirtualEnvironmentsSearchPathProvider } from '../../client/interpreter/locators/services/globalVirtualEnvService';
import { WorkspaceVirtualEnvService, WorkspaceVirtualEnvironmentsSearchPathProvider } from '../../client/interpreter/locators/services/workspaceVirtualEnvService';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { ConfigurationService } from '../../client/common/configuration/service';
import { SystemVariables } from '../../client/common/variables/systemVariables';
import { getPythonExecutable } from '../../client/common/configSettings';
import { WindowsRegistryService } from '../../client/interpreter/locators/services/windowsRegistryService';
import { IPlatformService, IRegistry, IFileSystem } from '../../client/common/platform/types';
import { RegistryImplementation } from '../../client/common/platform/registry';
import { PlatformService } from '../../client/common/platform/platformService';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { WorkspaceVirtualEnvWatcherService } from '../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { InterpreterWatcherBuilder } from '../../client/interpreter/locators/services/interpreterWatcherBuilder';
import { noop } from '../../client/common/utils/misc';
import { ITerminalActivationCommandProvider } from '../../client/common/terminal/types';
import { Bash } from '../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { PyEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';

export class DataScienceIocContainer extends UnitTestIocContainer {
    constructor() {
        super();
    }

    public registerDataScienceTypes() {
        this.registerFileSystemTypes();
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecution);
        this.serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
        this.serviceManager.add<IHistory>(IHistory, History);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServer);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
        this.serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
        this.serviceManager.add<IKnownSearchPathsForInterpreters>(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters);

        // Also setup a mock execution service and interpreter service
        const logger = TypeMoq.Mock.ofType<ILogger>();
        const condaService = TypeMoq.Mock.ofType<ICondaService>();
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        const currentProcess = new CurrentProcess();
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        const workspaceConfig: TypeMoq.IMock<WorkspaceConfiguration> = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceConfig.setup(ws => ws.has(TypeMoq.It.isAnyString()))
            .returns(() => false);
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString()))
            .returns(() => undefined);
        workspaceConfig.setup(ws => ws.get(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
            .returns((s, d) => d);
        class MockFileSystemWatcher implements FileSystemWatcher {
            ignoreCreateEvents: boolean;
            ignoreChangeEvents: boolean;
            ignoreDeleteEvents: boolean;
            public onDidCreate(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            onDidChange: Event<Uri>;
            onDidDelete: Event<Uri>;
            dispose() {
                undefined;
            }
        };
        workspaceService.setup(w => w.createFileSystemWatcher(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return new MockFileSystemWatcher();
        });
        workspaceService
        .setup(w => w.hasWorkspaceFolders)
        .returns(() => false);
        workspaceService.setup(w => w.rootPath).returns(() => '~');


        const systemVariables: SystemVariables = new SystemVariables(undefined);
        const env = {...systemVariables};

        // Look on the path for python
        let pythonPath = this.findPythonPath();
        pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
        const folders = ['Envs', '.virtualenvs'];
        pythonSettings.setup(x => x.venvFolders).returns(() => folders);
        pythonSettings.setup(x => x.venvPath).returns(() => path.join('~', 'foo'));

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

        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => workspaceConfig.object);

        // tslint:disable-next-line:no-empty
        logger.setup(l => l.logInformation(TypeMoq.It.isAny())).returns((m) => {}); // console.log(m)); // REnable this to debug the server

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
