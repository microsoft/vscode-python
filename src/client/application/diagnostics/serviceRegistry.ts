// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { LanguageServerType } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { IApplicationDiagnostics } from '../types';
import { ApplicationDiagnostics } from './applicationDiagnostics';
import {
    EnvironmentPathVariableDiagnosticsService,
    EnvironmentPathVariableDiagnosticsServiceId,
} from './checks/envPathVariable';
import {
    InvalidLaunchJsonDebuggerService,
    InvalidLaunchJsonDebuggerServiceId,
} from './checks/invalidLaunchJsonDebugger';
import {
    InvalidPythonPathInDebuggerService,
    InvalidPythonPathInDebuggerServiceId,
} from './checks/invalidPythonPathInDebugger';
import { LSNotSupportedDiagnosticService, LSNotSupportedDiagnosticServiceId } from './checks/lsNotSupported';
import {
    InvalidMacPythonInterpreterService,
    InvalidMacPythonInterpreterServiceId,
} from './checks/macPythonInterpreter';
import {
    PowerShellActivationHackDiagnosticsService,
    PowerShellActivationHackDiagnosticsServiceId,
} from './checks/powerShellActivation';
import { InvalidPythonInterpreterService, InvalidPythonInterpreterServiceId } from './checks/pythonInterpreter';
import { DiagnosticsCommandFactory } from './commands/factory';
import { IDiagnosticsCommandFactory } from './commands/types';
import { DiagnosticFilterService } from './filter';
import {
    DiagnosticCommandPromptHandlerService,
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt,
} from './promptHandler';
import { IDiagnosticFilterService, IDiagnosticHandlerService, IDiagnosticsService } from './types';

export function registerTypes(serviceManager: IServiceManager, languageServerType: LanguageServerType) {
    serviceManager.addSingleton<IDiagnosticFilterService>(IDiagnosticFilterService, DiagnosticFilterService);
    serviceManager.addSingleton<IDiagnosticHandlerService<MessageCommandPrompt>>(
        IDiagnosticHandlerService,
        DiagnosticCommandPromptHandlerService,
        DiagnosticCommandPromptHandlerServiceId
    );
    serviceManager.addSingleton<IDiagnosticsService>(
        IDiagnosticsService,
        EnvironmentPathVariableDiagnosticsService,
        EnvironmentPathVariableDiagnosticsServiceId
    );
    serviceManager.addSingleton<IDiagnosticsService>(
        IDiagnosticsService,
        InvalidLaunchJsonDebuggerService,
        InvalidLaunchJsonDebuggerServiceId
    );
    serviceManager.addSingleton<IDiagnosticsService>(
        IDiagnosticsService,
        InvalidPythonInterpreterService,
        InvalidPythonInterpreterServiceId
    );
    serviceManager.addSingleton<IDiagnosticsService>(
        IDiagnosticsService,
        InvalidPythonPathInDebuggerService,
        InvalidPythonPathInDebuggerServiceId
    );
    serviceManager.addSingleton<IDiagnosticsService>(
        IDiagnosticsService,
        PowerShellActivationHackDiagnosticsService,
        PowerShellActivationHackDiagnosticsServiceId
    );
    serviceManager.addSingleton<IDiagnosticsService>(
        IDiagnosticsService,
        InvalidMacPythonInterpreterService,
        InvalidMacPythonInterpreterServiceId
    );
    serviceManager.addSingleton<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory, DiagnosticsCommandFactory);
    serviceManager.addSingleton<IApplicationDiagnostics>(IApplicationDiagnostics, ApplicationDiagnostics);

    if (languageServerType === LanguageServerType.Microsoft) {
        serviceManager.addSingleton<IDiagnosticsService>(
            IDiagnosticsService,
            LSNotSupportedDiagnosticService,
            LSNotSupportedDiagnosticServiceId
        );
    }
}
