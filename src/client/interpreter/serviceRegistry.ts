// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionActivationService, IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { EnvironmentActivationService } from './activation/service';
import { IEnvironmentActivationService } from './activation/types';
import { InterpreterAutoSelectionService } from './autoSelection/index';
import { InterpreterEvaluation } from './autoSelection/interpreterSecurity/interpreterEvaluation';
import { InterpreterSecurityService } from './autoSelection/interpreterSecurity/interpreterSecurityService';
import { InterpreterSecurityStorage } from './autoSelection/interpreterSecurity/interpreterSecurityStorage';
import { InterpreterAutoSelectionProxyService } from './autoSelection/proxy';
import { CachedInterpretersAutoSelectionRule } from './autoSelection/rules/cached';
import { CurrentPathInterpretersAutoSelectionRule } from './autoSelection/rules/currentPath';
import { SettingsInterpretersAutoSelectionRule } from './autoSelection/rules/settings';
import { SystemWideInterpretersAutoSelectionRule } from './autoSelection/rules/system';
import { WindowsRegistryInterpretersAutoSelectionRule } from './autoSelection/rules/winRegistry';
import { WorkspaceVirtualEnvInterpretersAutoSelectionRule } from './autoSelection/rules/workspaceEnv';
import {
    AutoSelectionRule,
    IInterpreterAutoSelectionRule,
    IInterpreterAutoSelectionService,
    IInterpreterAutoSelectionProxyService,
    IInterpreterEvaluation,
    IInterpreterSecurityService,
    IInterpreterSecurityStorage,
} from './autoSelection/types';
import { InterpreterComparer } from './configuration/interpreterComparer';
import { ResetInterpreterCommand } from './configuration/interpreterSelector/commands/resetInterpreter';
import { SetInterpreterCommand } from './configuration/interpreterSelector/commands/setInterpreter';
import { SetShebangInterpreterCommand } from './configuration/interpreterSelector/commands/setShebangInterpreter';
import { InterpreterSelector } from './configuration/interpreterSelector/interpreterSelector';
import { PythonPathUpdaterService } from './configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IInterpreterSelector,
    IPythonPathUpdaterServiceFactory,
    IPythonPathUpdaterServiceManager,
} from './configuration/types';
import {
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterService,
    IInterpreterVersionService,
    IShebangCodeLensProvider,
} from './contracts';
import { InterpreterDisplay } from './display';
import { InterpreterLocatorProgressStatubarHandler } from './display/progressDisplay';
import { ShebangCodeLensProvider } from './display/shebangCodeLensProvider';
import { InterpreterHelper } from './helpers';
import { InterpreterService } from './interpreterService';
import { InterpreterVersionService } from './interpreterVersion';
import { VirtualEnvironmentPrompt } from './virtualEnvs/virtualEnvPrompt';

/**
 * Register all the new types inside this method.
 * This method is created for testing purposes. Registers all interpreter types except `IInterpreterAutoSelectionProxyService`, `IEnvironmentActivationService`.
 * See use case in `src\test\serviceRegistry.ts` for details
 * @param serviceManager
 */

export function registerInterpreterTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        InterpreterSecurityStorage,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        SetInterpreterCommand,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ResetInterpreterCommand,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        SetShebangInterpreterCommand,
    );
    serviceManager.addSingleton<IInterpreterEvaluation>(IInterpreterEvaluation, InterpreterEvaluation);
    serviceManager.addSingleton<IInterpreterSecurityStorage>(IInterpreterSecurityStorage, InterpreterSecurityStorage);
    serviceManager.addSingleton<IInterpreterSecurityService>(IInterpreterSecurityService, InterpreterSecurityService);

    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, VirtualEnvironmentPrompt);

    serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);

    serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
    serviceManager.addSingleton<IInterpreterDisplay>(IInterpreterDisplay, InterpreterDisplay);

    serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(
        IPythonPathUpdaterServiceFactory,
        PythonPathUpdaterServiceFactory,
    );
    serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(
        IPythonPathUpdaterServiceManager,
        PythonPathUpdaterService,
    );

    serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
    serviceManager.addSingleton<IShebangCodeLensProvider>(IShebangCodeLensProvider, ShebangCodeLensProvider);
    serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);

    serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);

    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        InterpreterLocatorProgressStatubarHandler,
    );

    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        CurrentPathInterpretersAutoSelectionRule,
        AutoSelectionRule.currentPath,
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        SystemWideInterpretersAutoSelectionRule,
        AutoSelectionRule.systemWide,
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        WindowsRegistryInterpretersAutoSelectionRule,
        AutoSelectionRule.windowsRegistry,
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        WorkspaceVirtualEnvInterpretersAutoSelectionRule,
        AutoSelectionRule.workspaceVirtualEnvs,
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        CachedInterpretersAutoSelectionRule,
        AutoSelectionRule.cachedInterpreters,
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionRule>(
        IInterpreterAutoSelectionRule,
        SettingsInterpretersAutoSelectionRule,
        AutoSelectionRule.settings,
    );
    serviceManager.addSingleton<IInterpreterAutoSelectionService>(
        IInterpreterAutoSelectionService,
        InterpreterAutoSelectionService,
    );
}

export function registerTypes(serviceManager: IServiceManager): void {
    registerInterpreterTypes(serviceManager);
    serviceManager.addSingleton<IInterpreterAutoSelectionProxyService>(
        IInterpreterAutoSelectionProxyService,
        InterpreterAutoSelectionProxyService,
    );
    serviceManager.addSingleton<IEnvironmentActivationService>(
        EnvironmentActivationService,
        EnvironmentActivationService,
    );
    serviceManager.addSingleton<IEnvironmentActivationService>(
        IEnvironmentActivationService,
        EnvironmentActivationService,
    );
}
