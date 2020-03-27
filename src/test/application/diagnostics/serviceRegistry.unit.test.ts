// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { LanguageServerType } from '../../../client/activation/types';
import { ApplicationDiagnostics } from '../../../client/application/diagnostics/applicationDiagnostics';
import {
    EnvironmentPathVariableDiagnosticsService,
    EnvironmentPathVariableDiagnosticsServiceId
} from '../../../client/application/diagnostics/checks/envPathVariable';
import {
    InvalidLaunchJsonDebuggerService,
    InvalidLaunchJsonDebuggerServiceId
} from '../../../client/application/diagnostics/checks/invalidLaunchJsonDebugger';
import {
    InvalidPythonPathInDebuggerService,
    InvalidPythonPathInDebuggerServiceId
} from '../../../client/application/diagnostics/checks/invalidPythonPathInDebugger';
import {
    LSNotSupportedDiagnosticService,
    LSNotSupportedDiagnosticServiceId
} from '../../../client/application/diagnostics/checks/lsNotSupported';
import {
    InvalidMacPythonInterpreterService,
    InvalidMacPythonInterpreterServiceId
} from '../../../client/application/diagnostics/checks/macPythonInterpreter';
import {
    PowerShellActivationHackDiagnosticsService,
    PowerShellActivationHackDiagnosticsServiceId
} from '../../../client/application/diagnostics/checks/powerShellActivation';
import {
    InvalidPythonInterpreterService,
    InvalidPythonInterpreterServiceId
} from '../../../client/application/diagnostics/checks/pythonInterpreter';
import { DiagnosticsCommandFactory } from '../../../client/application/diagnostics/commands/factory';
import { IDiagnosticsCommandFactory } from '../../../client/application/diagnostics/commands/types';
import { DiagnosticFilterService } from '../../../client/application/diagnostics/filter';
import {
    DiagnosticCommandPromptHandlerService,
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt
} from '../../../client/application/diagnostics/promptHandler';
import { registerTypes } from '../../../client/application/diagnostics/serviceRegistry';
import {
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
    IDiagnosticsService
} from '../../../client/application/diagnostics/types';
import { IApplicationDiagnostics } from '../../../client/application/types';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { IServiceManager } from '../../../client/ioc/types';

suite('Application Diagnostics - Register classes in IOC Container', () => {
    let serviceManager: IServiceManager;
    setup(() => {
        serviceManager = mock(ServiceManager);
    });
    test('Register Classes', () => {
        registerTypes(instance(serviceManager), LanguageServerType.Microsoft);

        verify(
            serviceManager.addSingleton<IDiagnosticFilterService>(IDiagnosticFilterService, DiagnosticFilterService)
        );
        verify(
            serviceManager.addSingleton<IDiagnosticHandlerService<MessageCommandPrompt>>(
                IDiagnosticHandlerService,
                DiagnosticCommandPromptHandlerService,
                DiagnosticCommandPromptHandlerServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                EnvironmentPathVariableDiagnosticsService,
                EnvironmentPathVariableDiagnosticsServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                InvalidLaunchJsonDebuggerService,
                InvalidLaunchJsonDebuggerServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                InvalidPythonInterpreterService,
                InvalidPythonInterpreterServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                InvalidPythonPathInDebuggerService,
                InvalidPythonPathInDebuggerServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                LSNotSupportedDiagnosticService,
                LSNotSupportedDiagnosticServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                PowerShellActivationHackDiagnosticsService,
                PowerShellActivationHackDiagnosticsServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsService>(
                IDiagnosticsService,
                InvalidMacPythonInterpreterService,
                InvalidMacPythonInterpreterServiceId
            )
        );
        verify(
            serviceManager.addSingleton<IDiagnosticsCommandFactory>(
                IDiagnosticsCommandFactory,
                DiagnosticsCommandFactory
            )
        );
        verify(serviceManager.addSingleton<IApplicationDiagnostics>(IApplicationDiagnostics, ApplicationDiagnostics));
    });
});
