// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionActivationService, IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { PreWarmActivatedEnvironmentVariables } from './activation/preWarmVariables';
import { EnvironmentActivationService } from './activation/service';
import { TerminalEnvironmentActivationService } from './activation/terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from './activation/types';
import { WrapperEnvironmentActivationService } from './activation/wrapperEnvironmentActivationService';
import { InterpreterAutoSelectionService } from './autoSelection/index';
import { InterpreterAutoSeletionProxyService } from './autoSelection/proxy';
import { CachedInterpretersAutoSelectionRule } from './autoSelection/rules/cached';
import { CurrentPathInterpretersAutoSelectionRule } from './autoSelection/rules/currentPath';
import { SettingsInterpretersAutoSelectionRule } from './autoSelection/rules/settings';
import { SystemWideInterpretersAutoSelectionRule } from './autoSelection/rules/system';
import { WindowsRegistryInterpretersAutoSelectionRule } from './autoSelection/rules/winRegistry';
import { WorkspaceVirtualEnvInterpretersAutoSelectionRule } from './autoSelection/rules/workspaceEnv';
import { AutoSelectionRule, IInterpreterAutoSelectionRule, IInterpreterAutoSelectionService, IInterpreterAutoSeletionProxyService } from './autoSelection/types';
import { InterpreterComparer } from './configuration/interpreterComparer';
import { InterpreterSelector } from './configuration/interpreterSelector';
import { PythonPathUpdaterService } from './configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './configuration/pythonPathUpdaterServiceFactory';
import { IInterpreterComparer, IInterpreterSelector, IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from './configuration/types';
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
} from './contracts';
import { InterpreterDisplay } from './display';
import { InterpreterSelectionTip } from './display/interpreterSelectionTip';
import { InterpreterLocatorProgressStatubarHandler } from './display/progressDisplay';
import { ShebangCodeLensProvider } from './display/shebangCodeLensProvider';
import { InterpreterHelper } from './helpers';
import { InterpreterService } from './interpreterService';
import { InterpreterVersionService } from './interpreterVersion';
import { InterpreterLocatorHelper } from './locators/helpers';
import { PythonInterpreterLocatorService } from './locators/index';
import { InterpreterLocatorProgressService } from './locators/progressService';
import { CondaEnvFileService } from './locators/services/condaEnvFileService';
import { CondaEnvService } from './locators/services/condaEnvService';
import { CondaService } from './locators/services/condaService';
import { CurrentPathService, PythonInPathCommandProvider } from './locators/services/currentPathService';
import { GlobalVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvService } from './locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from './locators/services/hashProvider';
import { InterpeterHashProviderFactory } from './locators/services/hashProviderFactory';
import { InterpreterFilter } from './locators/services/interpreterFilter';
import { InterpreterWatcherBuilder } from './locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from './locators/services/KnownPathsService';
import { PipEnvService } from './locators/services/pipEnvService';
import { PipEnvServiceHelper } from './locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from './locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from './locators/services/windowsStoreInterpreter';
import { WorkspaceVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvService } from './locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from './locators/services/workspaceVirtualEnvWatcherService';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from './locators/types';
import { CondaInheritEnvPrompt } from './virtualEnvs/condaInheritEnvPrompt';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';
import { VirtualEnvironmentPrompt } from './virtualEnvs/virtualEnvPrompt';

/**
 * Register all the new types inside this method.
 * This method is created for testing purposes. Registers all interpreter types except `IInterpreterAutoSeletionProxyService`, `IEnvironmentActivationService`.
 * See use case in `src\test\serviceRegistry.ts` for details
 * @param serviceManager
 */
export function registerInterpreterTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters);
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global');
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace');

    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
    serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, VirtualEnvironmentPrompt);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, InterpreterSelectionTip);
    serviceManager.addSingleton<IPythonInPathCommandProvider>(IPythonInPathCommandProvider, PythonInPathCommandProvider);

    serviceManager.add<IInterpreterWatcher>(IInterpreterWatcher, WorkspaceVirtualEnvWatcherService, WORKSPACE_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);

    serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IPipEnvService, PipEnvService);

    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);
    serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
    serviceManager.addSingleton<IInterpreterDisplay>(IInterpreterDisplay, InterpreterDisplay);

    serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory);
    serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, PythonPathUpdaterService);

    serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
    serviceManager.addSingleton<IShebangCodeLensProvider>(IShebangCodeLensProvider, ShebangCodeLensProvider);
    serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
    serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
    serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);

    serviceManager.addSingleton<IInterpreterLocatorProgressHandler>(IInterpreterLocatorProgressHandler, InterpreterLocatorProgressStatubarHandler);
    serviceManager.addSingleton<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService, InterpreterLocatorProgressService);

    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, CurrentPathInterpretersAutoSelectionRule, AutoSelectionRule.currentPath);
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, SystemWideInterpretersAutoSelectionRule, AutoSelectionRule.systemWide);
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, WindowsRegistryInterpretersAutoSelectionRule, AutoSelectionRule.windowsRegistry);
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        WorkspaceVirtualEnvInterpretersAutoSelectionRule,
        AutoSelectionRule.workspaceVirtualEnvs
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, CachedInterpretersAutoSelectionRule, AutoSelectionRule.cachedInterpreters);
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, SettingsInterpretersAutoSelectionRule, AutoSelectionRule.settings);
    serviceManager.addSingleton<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService, InterpreterAutoSelectionService);

    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, CondaInheritEnvPrompt);
    serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
    serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
    serviceManager.addSingleton<InterpeterHashProviderFactory>(InterpeterHashProviderFactory, InterpeterHashProviderFactory);
    serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, PreWarmActivatedEnvironmentVariables);
}

export function registerTypes(serviceManager: IServiceManager) {
    registerInterpreterTypes(serviceManager);
    serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(IInterpreterAutoSeletionProxyService, InterpreterAutoSeletionProxyService);
    serviceManager.addSingleton<IEnvironmentActivationService>(EnvironmentActivationService, EnvironmentActivationService);
    serviceManager.addSingleton<IEnvironmentActivationService>(TerminalEnvironmentActivationService, TerminalEnvironmentActivationService);
    serviceManager.addSingleton<IEnvironmentActivationService>(IEnvironmentActivationService, WrapperEnvironmentActivationService);
}
