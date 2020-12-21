// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../../client/activation/types';
import { EnvironmentActivationService } from '../../client/interpreter/activation/service';
import { TerminalEnvironmentActivationService } from '../../client/interpreter/activation/terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterAutoSelectionService } from '../../client/interpreter/autoSelection';
import { InterpreterEvaluation } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterEvaluation';
import { InterpreterSecurityService } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityService';
import { InterpreterSecurityStorage } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityStorage';
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
    IInterpreterAutoSeletionProxyService,
    IInterpreterEvaluation,
    IInterpreterSecurityService,
    IInterpreterSecurityStorage,
} from '../../client/interpreter/autoSelection/types';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { ResetInterpreterCommand } from '../../client/interpreter/configuration/interpreterSelector/commands/resetInterpreter';
import { SetInterpreterCommand } from '../../client/interpreter/configuration/interpreterSelector/commands/setInterpreter';
import { SetShebangInterpreterCommand } from '../../client/interpreter/configuration/interpreterSelector/commands/setShebangInterpreter';
import { InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector/interpreterSelector';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IInterpreterSelector,
    IPythonPathUpdaterServiceFactory,
    IPythonPathUpdaterServiceManager,
} from '../../client/interpreter/configuration/types';
import {
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorProgressHandler,
    IInterpreterService,
    IInterpreterVersionService,
    IShebangCodeLensProvider,
} from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { InterpreterSelectionTip } from '../../client/interpreter/display/interpreterSelectionTip';
import { InterpreterLocatorProgressStatubarHandler } from '../../client/interpreter/display/progressDisplay';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
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
            [IExtensionSingleActivationService, SetInterpreterCommand],
            [IExtensionSingleActivationService, ResetInterpreterCommand],
            [IExtensionSingleActivationService, SetShebangInterpreterCommand],
            [IExtensionSingleActivationService, InterpreterSecurityStorage],
            [IInterpreterEvaluation, InterpreterEvaluation],
            [IInterpreterSecurityStorage, InterpreterSecurityStorage],
            [IInterpreterSecurityService, InterpreterSecurityService],

            [IVirtualEnvironmentManager, VirtualEnvironmentManager],
            [IExtensionActivationService, VirtualEnvironmentPrompt],
            [IExtensionSingleActivationService, InterpreterSelectionTip],

            [IInterpreterVersionService, InterpreterVersionService],

            [IInterpreterService, InterpreterService],
            [IInterpreterDisplay, InterpreterDisplay],

            [IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory],
            [IPythonPathUpdaterServiceManager, PythonPathUpdaterService],

            [IInterpreterSelector, InterpreterSelector],
            [IShebangCodeLensProvider, ShebangCodeLensProvider],
            [IInterpreterHelper, InterpreterHelper],
            [IInterpreterComparer, InterpreterComparer],

            [IInterpreterLocatorProgressHandler, InterpreterLocatorProgressStatubarHandler],

            [IInterpreterAutoSelectionRule, CurrentPathInterpretersAutoSelectionRule, AutoSelectionRule.currentPath],
            [IInterpreterAutoSelectionRule, SystemWideInterpretersAutoSelectionRule, AutoSelectionRule.systemWide],
            [
                IInterpreterAutoSelectionRule,
                WindowsRegistryInterpretersAutoSelectionRule,
                AutoSelectionRule.windowsRegistry,
            ],
            [
                IInterpreterAutoSelectionRule,
                WorkspaceVirtualEnvInterpretersAutoSelectionRule,
                AutoSelectionRule.workspaceVirtualEnvs,
            ],
            [IInterpreterAutoSelectionRule, CachedInterpretersAutoSelectionRule, AutoSelectionRule.cachedInterpreters],
            [IInterpreterAutoSelectionRule, SettingsInterpretersAutoSelectionRule, AutoSelectionRule.settings],
            [IInterpreterAutoSeletionProxyService, InterpreterAutoSeletionProxyService],
            [IInterpreterAutoSelectionService, InterpreterAutoSelectionService],

            [EnvironmentActivationService, EnvironmentActivationService],
            [TerminalEnvironmentActivationService, TerminalEnvironmentActivationService],
            [IEnvironmentActivationService, EnvironmentActivationService],
            [IExtensionActivationService, CondaInheritEnvPrompt],
        ].forEach((mapping) => {
            verify(serviceManager.addSingleton.apply(serviceManager, mapping as any)).once();
        });
    });
});
