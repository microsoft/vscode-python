// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Container } from 'inversify';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Disposable, Memento, OutputChannel } from 'vscode';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../client/activation/types';
import { STANDARD_OUTPUT_CHANNEL } from '../client/common/constants';
import { Logger } from '../client/common/logger';
import { IS_WINDOWS } from '../client/common/platform/constants';
import { FileSystem } from '../client/common/platform/fileSystem';
import { PathUtils } from '../client/common/platform/pathUtils';
import { PlatformService } from '../client/common/platform/platformService';
import { RegistryImplementation } from '../client/common/platform/registry';
import { registerTypes as platformRegisterTypes } from '../client/common/platform/serviceRegistry';
import { IFileSystem, IPlatformService, IRegistry } from '../client/common/platform/types';
import { BufferDecoder } from '../client/common/process/decoder';
import { ProcessService } from '../client/common/process/proc';
import { PythonExecutionFactory } from '../client/common/process/pythonExecutionFactory';
import { PythonToolExecutionService } from '../client/common/process/pythonToolService';
import { registerTypes as processRegisterTypes } from '../client/common/process/serviceRegistry';
import { IBufferDecoder, IProcessServiceFactory, IPythonExecutionFactory, IPythonToolExecutionService } from '../client/common/process/types';
import { registerTypes as commonRegisterTypes } from '../client/common/serviceRegistry';
import { GLOBAL_MEMENTO, ICurrentProcess, IDisposableRegistry, ILogger, IMemento, IOutputChannel, IPathUtils, IsWindows, WORKSPACE_MEMENTO } from '../client/common/types';
import { registerTypes as variableRegisterTypes } from '../client/common/variables/serviceRegistry';
import { registerTypes as formattersRegisterTypes } from '../client/formatters/serviceRegistry';
import { EnvironmentActivationService } from '../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../client/interpreter/activation/types';
import { InterpreterAutoSelectionService } from '../client/interpreter/autoSelection';
import { CachedInterpretersAutoSelectionRule } from '../client/interpreter/autoSelection/rules/cached';
import { CurrentPathInterpretersAutoSelectionRule } from '../client/interpreter/autoSelection/rules/currentPath';
import { SettingsInterpretersAutoSelectionRule } from '../client/interpreter/autoSelection/rules/settings';
import { SystemWideInterpretersAutoSelectionRule } from '../client/interpreter/autoSelection/rules/system';
import { WindowsRegistryInterpretersAutoSelectionRule } from '../client/interpreter/autoSelection/rules/winRegistry';
import { WorkspaceVirtualEnvInterpretersAutoSelectionRule } from '../client/interpreter/autoSelection/rules/workspaceEnv';
import {
    AutoSelectionRule,
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService
} from '../client/interpreter/autoSelection/types';
import { InterpreterComparer } from '../client/interpreter/configuration/interpreterComparer';
import { InterpreterSelector } from '../client/interpreter/configuration/interpreterSelector';
import { PythonPathUpdaterService } from '../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { IInterpreterComparer, IInterpreterSelector, IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from '../client/interpreter/configuration/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorHelper,
    IInterpreterLocatorProgressHandler,
    IInterpreterLocatorProgressService,
    IInterpreterLocatorService,
    IInterpreterService,
    IInterpreterVersionService,
    IInterpreterWatcher,
    IInterpreterWatcherBuilder,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IPipEnvService,
    IShebangCodeLensProvider,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../client/interpreter/contracts';
import { InterpreterDisplay } from '../client/interpreter/display';
import { InterpreterSelectionTip } from '../client/interpreter/display/interpreterSelectionTip';
import { InterpreterLocatorProgressStatubarHandler } from '../client/interpreter/display/progressDisplay';
import { ShebangCodeLensProvider } from '../client/interpreter/display/shebangCodeLensProvider';
import { InterpreterHelper } from '../client/interpreter/helpers';
import { InterpreterService } from '../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../client/interpreter/interpreterVersion';
import { PythonInterpreterLocatorService } from '../client/interpreter/locators';
import { InterpreterLocatorHelper } from '../client/interpreter/locators/helpers';
import { InterpreterLocatorProgressService } from '../client/interpreter/locators/progressService';
import { CondaEnvFileService } from '../client/interpreter/locators/services/condaEnvFileService';
import { CondaEnvService } from '../client/interpreter/locators/services/condaEnvService';
import { CondaService } from '../client/interpreter/locators/services/condaService';
import { CurrentPathService, PythonInPathCommandProvider } from '../client/interpreter/locators/services/currentPathService';
import { GlobalVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvService } from '../client/interpreter/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from '../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../client/interpreter/locators/services/hashProviderFactory';
import { InterpreterFilter } from '../client/interpreter/locators/services/interpreterFilter';
import { InterpreterWatcherBuilder } from '../client/interpreter/locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from '../client/interpreter/locators/services/KnownPathsService';
import { PipEnvService } from '../client/interpreter/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../client/interpreter/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from '../client/interpreter/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from '../client/interpreter/locators/services/windowsStoreInterpreter';
import { WorkspaceVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvService } from '../client/interpreter/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from '../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../client/interpreter/locators/types';
import { VirtualEnvironmentManager } from '../client/interpreter/virtualEnvs';
import { CondaInheritEnvPrompt } from '../client/interpreter/virtualEnvs/condaInheritEnvPrompt';
import { IVirtualEnvironmentManager } from '../client/interpreter/virtualEnvs/types';
import { VirtualEnvironmentPrompt } from '../client/interpreter/virtualEnvs/virtualEnvPrompt';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';
import { registerTypes as lintersRegisterTypes } from '../client/linters/serviceRegistry';
import { TEST_OUTPUT_CHANNEL } from '../client/testing/common/constants';
import { registerTypes as unittestsRegisterTypes } from '../client/testing/serviceRegistry';
import { MockOutputChannel } from './mockClasses';
import { MockAutoSelectionService } from './mocks/autoSelector';
import { MockMemento } from './mocks/mementos';
import { MockProcessService } from './mocks/proc';
import { MockProcess } from './mocks/process';

export class IocContainer {
    public readonly serviceManager: IServiceManager;
    public readonly serviceContainer: IServiceContainer;

    private disposables: Disposable[] = [];

    constructor() {
        const cont = new Container();
        this.serviceManager = new ServiceManager(cont);
        this.serviceContainer = new ServiceContainer(cont);

        this.serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, this.serviceContainer);
        this.serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, this.disposables);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, GLOBAL_MEMENTO);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, WORKSPACE_MEMENTO);

        const stdOutputChannel = new MockOutputChannel('Python');
        this.disposables.push(stdOutputChannel);
        this.serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, stdOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const testOutputChannel = new MockOutputChannel('Python Test - UnitTests');
        this.disposables.push(testOutputChannel);
        this.serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, testOutputChannel, TEST_OUTPUT_CHANNEL);

        this.serviceManager.addSingleton<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService, MockAutoSelectionService);
        this.serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(IInterpreterAutoSeletionProxyService, MockAutoSelectionService);
    }
    public async dispose(): Promise<void> {
        for (const disposable of this.disposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
    }

    public registerCommonTypes(registerFileSystem: boolean = true) {
        commonRegisterTypes(this.serviceManager);
        if (registerFileSystem) {
            this.registerFileSystemTypes();
        }
    }
    public registerFileSystemTypes() {
        this.serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
        this.serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    }
    public registerProcessTypes() {
        processRegisterTypes(this.serviceManager);
        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        this.serviceManager.addSingletonInstance<IEnvironmentActivationService>(IEnvironmentActivationService, instance(mockEnvironmentActivationService));
        this.serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
        this.serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
        this.serviceManager.addSingleton<InterpeterHashProviderFactory>(InterpeterHashProviderFactory, InterpeterHashProviderFactory);
        this.serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
    }
    public registerVariableTypes() {
        variableRegisterTypes(this.serviceManager);
    }
    public registerUnitTestTypes() {
        unittestsRegisterTypes(this.serviceManager);
    }
    public registerLinterTypes() {
        lintersRegisterTypes(this.serviceManager);
    }
    public registerFormatterTypes() {
        formattersRegisterTypes(this.serviceManager);
    }
    public registerPlatformTypes() {
        platformRegisterTypes(this.serviceManager);
    }
    public registerInterpreterTypes() {
        // The method content used to be registerInterpreterTypes(this.serviceManager) earlier.
        // But it was registering a type `IInterpreterAutoSeletionProxyService` which is unfortunately already registered in the constructor, so this method was unusable.
        // Removing `IInterpreterAutoSeletionProxyService` from the constructor is the right thing but requires a lot of effort as almost all tests start failing without it.
        // So manually pasting contents of registerInterpreterTypes(this.serviceManager) here without registering `IInterpreterAutoSeletionProxyService`.

        this.serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters);
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global');
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
            IVirtualEnvironmentsSearchPathProvider,
            WorkspaceVirtualEnvironmentsSearchPathProvider,
            'workspace'
        );

        this.serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
        this.serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
        this.serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);
        this.serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, VirtualEnvironmentPrompt);
        this.serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, InterpreterSelectionTip);
        this.serviceManager.addSingleton<IPythonInPathCommandProvider>(IPythonInPathCommandProvider, PythonInPathCommandProvider);

        this.serviceManager.add<IInterpreterWatcher>(IInterpreterWatcher, WorkspaceVirtualEnvWatcherService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);

        this.serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
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
        this.serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
        this.serviceManager.addSingleton<IInterpreterDisplay>(IInterpreterDisplay, InterpreterDisplay);

        this.serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory);
        this.serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, PythonPathUpdaterService);

        this.serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
        this.serviceManager.addSingleton<IShebangCodeLensProvider>(IShebangCodeLensProvider, ShebangCodeLensProvider);
        this.serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
        this.serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
        this.serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);

        this.serviceManager.addSingleton<IInterpreterLocatorProgressHandler>(IInterpreterLocatorProgressHandler, InterpreterLocatorProgressStatubarHandler);
        this.serviceManager.addSingleton<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService, InterpreterLocatorProgressService);

        this.serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, CurrentPathInterpretersAutoSelectionRule, AutoSelectionRule.currentPath);
        this.serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, SystemWideInterpretersAutoSelectionRule, AutoSelectionRule.systemWide);
        this.serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
            IInterpreterAutoSelectionRule,
            WindowsRegistryInterpretersAutoSelectionRule,
            AutoSelectionRule.windowsRegistry
        );
        this.serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
            IInterpreterAutoSelectionRule,
            WorkspaceVirtualEnvInterpretersAutoSelectionRule,
            AutoSelectionRule.workspaceVirtualEnvs
        );
        this.serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, CachedInterpretersAutoSelectionRule, AutoSelectionRule.cachedInterpreters);
        this.serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, SettingsInterpretersAutoSelectionRule, AutoSelectionRule.settings);
        this.serviceManager.addSingleton<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService, InterpreterAutoSelectionService);

        this.serviceManager.addSingleton<IEnvironmentActivationService>(IEnvironmentActivationService, EnvironmentActivationService);

        this.serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, CondaInheritEnvPrompt);
        this.serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
        this.serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
        this.serviceManager.addSingleton<InterpeterHashProviderFactory>(InterpeterHashProviderFactory, InterpeterHashProviderFactory);
        this.serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
    }
    public registerMockProcessTypes() {
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        // tslint:disable-next-line:no-any
        const processService = new MockProcessService(new ProcessService(new BufferDecoder(), process.env as any));
        processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService));
        this.serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, processServiceFactory.object);
        this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
        this.serviceManager.addSingleton<IPythonToolExecutionService>(IPythonToolExecutionService, PythonToolExecutionService);
        this.serviceManager.addSingleton<IEnvironmentActivationService>(IEnvironmentActivationService, EnvironmentActivationService);
        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        this.serviceManager.rebindInstance<IEnvironmentActivationService>(IEnvironmentActivationService, instance(mockEnvironmentActivationService));
    }

    public registerMockInterpreterTypes() {
        this.serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IPipEnvService, PipEnvService);

        this.serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
        this.serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
        this.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);
    }

    public registerMockProcess() {
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        this.serviceManager.addSingleton<ILogger>(ILogger, Logger);
        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, MockProcess);
    }
}
