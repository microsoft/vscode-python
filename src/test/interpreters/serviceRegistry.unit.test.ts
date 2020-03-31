// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import { instance, mock, verify } from 'ts-mockito';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../../client/activation/types';
import { EnvironmentActivationService } from '../../client/interpreter/activation/service';
import { TerminalEnvironmentActivationService } from '../../client/interpreter/activation/terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterAutoSelectionService } from '../../client/interpreter/autoSelection';
import { InterpreterAutoSeletionProxyService } from '../../client/interpreter/autoSelection/proxy';
import { CachedInterpretersAutoSelectionRule } from '../../client/interpreter/autoSelection/rules/cached';
import { CurrentPathInterpretersAutoSelectionRule } from '../../client/interpreter/autoSelection/rules/currentPath';
import { SettingsInterpretersAutoSelectionRule } from '../../client/interpreter/autoSelection/rules/settings';
import { SystemWideInterpretersAutoSelectionRule } from '../../client/interpreter/autoSelection/rules/system';
import { WindowsRegistryInterpretersAutoSelectionRule } from '../../client/interpreter/autoSelection/rules/winRegistry';
import { WorkspaceVirtualEnvInterpretersAutoSelectionRule } from '../../client/interpreter/autoSelection/rules/workspaceEnv';
import {
    AutoSelectionRule,
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSelectionService,
    IInterpreterAutoSeletionProxyService
} from '../../client/interpreter/autoSelection/types';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IInterpreterSelector,
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
} from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { InterpreterSelectionTip } from '../../client/interpreter/display/interpreterSelectionTip';
import { InterpreterLocatorProgressStatubarHandler } from '../../client/interpreter/display/progressDisplay';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { PythonInterpreterLocatorService } from '../../client/interpreter/locators';
import { InterpreterLocatorHelper } from '../../client/interpreter/locators/helpers';
import { InterpreterLocatorProgressService } from '../../client/interpreter/locators/progressService';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/interpreter/locators/services/condaEnvService';
import { CondaService } from '../../client/interpreter/locators/services/condaService';
import {
    CurrentPathService,
    PythonInPathCommandProvider
} from '../../client/interpreter/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService
} from '../../client/interpreter/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from '../../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../client/interpreter/locators/services/hashProviderFactory';
import { InterpreterWatcherBuilder } from '../../client/interpreter/locators/services/interpreterWatcherBuilder';
import {
    KnownPathsService,
    KnownSearchPathsForInterpreters
} from '../../client/interpreter/locators/services/KnownPathsService';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../../client/interpreter/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from '../../client/interpreter/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from '../../client/interpreter/locators/services/windowsStoreInterpreter';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService
} from '../../client/interpreter/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from '../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../../client/interpreter/locators/types';
import { registerTypes } from '../../client/interpreter/serviceRegistry';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { CondaInheritEnvPrompt } from '../../client/interpreter/virtualEnvs/condaInheritEnvPrompt';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { VirtualEnvironmentPrompt } from '../../client/interpreter/virtualEnvs/virtualEnvPrompt';
import { ServiceManager } from '../../client/ioc/serviceManager';

suite('Interpreters - Service Registry', () => {
    test('Registrations', () => {
        const serviceManager = mock(ServiceManager);
        registerTypes(instance(serviceManager));

        [
            [IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters],
            [IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global'],
            [IVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace'],

            [ICondaService, CondaService],
            [IPipEnvServiceHelper, PipEnvServiceHelper],
            [IVirtualEnvironmentManager, VirtualEnvironmentManager],
            [IExtensionActivationService, VirtualEnvironmentPrompt],
            [IExtensionSingleActivationService, InterpreterSelectionTip],
            [IPythonInPathCommandProvider, PythonInPathCommandProvider],

            [IInterpreterWatcherBuilder, InterpreterWatcherBuilder],

            [IInterpreterVersionService, InterpreterVersionService],
            [IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE],
            [IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE],
            [IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE],
            [IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE],
            [IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE],
            [IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE],
            [IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE],
            [IPipEnvService, PipEnvService],

            [IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE],
            [IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE],
            [IInterpreterService, InterpreterService],
            [IInterpreterDisplay, InterpreterDisplay],

            [IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory],
            [IPythonPathUpdaterServiceManager, PythonPathUpdaterService],

            [IInterpreterSelector, InterpreterSelector],
            [IShebangCodeLensProvider, ShebangCodeLensProvider],
            [IInterpreterHelper, InterpreterHelper],
            [IInterpreterLocatorHelper, InterpreterLocatorHelper],
            [IInterpreterComparer, InterpreterComparer],

            [IInterpreterLocatorProgressHandler, InterpreterLocatorProgressStatubarHandler],
            [IInterpreterLocatorProgressService, InterpreterLocatorProgressService],

            [IInterpreterAutoSelectionRule, CurrentPathInterpretersAutoSelectionRule, AutoSelectionRule.currentPath],
            [IInterpreterAutoSelectionRule, SystemWideInterpretersAutoSelectionRule, AutoSelectionRule.systemWide],
            [
                IInterpreterAutoSelectionRule,
                WindowsRegistryInterpretersAutoSelectionRule,
                AutoSelectionRule.windowsRegistry
            ],
            [
                IInterpreterAutoSelectionRule,
                WorkspaceVirtualEnvInterpretersAutoSelectionRule,
                AutoSelectionRule.workspaceVirtualEnvs
            ],
            [IInterpreterAutoSelectionRule, CachedInterpretersAutoSelectionRule, AutoSelectionRule.cachedInterpreters],
            [IInterpreterAutoSelectionRule, SettingsInterpretersAutoSelectionRule, AutoSelectionRule.settings],
            [IInterpreterAutoSeletionProxyService, InterpreterAutoSeletionProxyService],
            [IInterpreterAutoSelectionService, InterpreterAutoSelectionService],

            [EnvironmentActivationService, EnvironmentActivationService],
            [TerminalEnvironmentActivationService, TerminalEnvironmentActivationService],
            [IEnvironmentActivationService, EnvironmentActivationService],
            [IExtensionActivationService, CondaInheritEnvPrompt],

            [WindowsStoreInterpreter, WindowsStoreInterpreter],
            [InterpreterHashProvider, InterpreterHashProvider],
            [InterpeterHashProviderFactory, InterpeterHashProviderFactory]
        ].forEach((mapping) => {
            verify(serviceManager.addSingleton.apply(serviceManager, mapping as any)).once();
        });
        verify(
            serviceManager.add<IInterpreterWatcher>(
                IInterpreterWatcher,
                WorkspaceVirtualEnvWatcherService,
                WORKSPACE_VIRTUAL_ENV_SERVICE
            )
        ).once();
    });
});
