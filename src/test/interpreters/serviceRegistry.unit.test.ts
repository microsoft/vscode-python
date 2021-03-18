// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../../client/activation/types';
import { EnvironmentActivationService } from '../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterAutoSelectionService } from '../../client/interpreter/autoSelection';
import { InterpreterEvaluation } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterEvaluation';
import { InterpreterSecurityService } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityService';
import { InterpreterSecurityStorage } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityStorage';
import { InterpreterAutoSelectionProxyService } from '../../client/interpreter/autoSelection/proxy';
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
    IInterpreterAutoSelectionProxyService,
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
    IInterpreterService,
    IInterpreterVersionService,
    IShebangCodeLensProvider,
} from '../../client/interpreter/contracts';
import { InterpreterDisplay } from '../../client/interpreter/display';
import { InterpreterLocatorProgressStatubarHandler } from '../../client/interpreter/display/progressDisplay';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { registerTypes } from '../../client/interpreter/serviceRegistry';
import { CondaInheritEnvPrompt } from '../../client/interpreter/virtualEnvs/condaInheritEnvPrompt';
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

            [IExtensionActivationService, VirtualEnvironmentPrompt],

            [IInterpreterVersionService, InterpreterVersionService],

            [IInterpreterService, InterpreterService],
            [IInterpreterDisplay, InterpreterDisplay],

            [IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory],
            [IPythonPathUpdaterServiceManager, PythonPathUpdaterService],

            [IInterpreterSelector, InterpreterSelector],
            [IShebangCodeLensProvider, ShebangCodeLensProvider],
            [IInterpreterHelper, InterpreterHelper],
            [IInterpreterComparer, InterpreterComparer],

            [IExtensionSingleActivationService, InterpreterLocatorProgressStatubarHandler],

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
            [IInterpreterAutoSelectionProxyService, InterpreterAutoSelectionProxyService],
            [IInterpreterAutoSelectionService, InterpreterAutoSelectionService],

            [EnvironmentActivationService, EnvironmentActivationService],
            [IEnvironmentActivationService, EnvironmentActivationService],
            [IExtensionActivationService, CondaInheritEnvPrompt],
        ].forEach((mapping) => {
            // eslint-disable-next-line prefer-spread
            verify(serviceManager.addSingleton.apply(serviceManager, mapping as never)).once();
        });
    });
});
