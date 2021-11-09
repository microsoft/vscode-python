// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export enum DiagnosticCodes {
    InvalidEnvironmentPathVariableDiagnostic = 'InvalidEnvironmentPathVariableDiagnostic',
    InvalidDebuggerTypeDiagnostic = 'InvalidDebuggerTypeDiagnostic',
    NoPythonInterpretersDiagnostic = 'NoPythonInterpretersDiagnostic',
    MacInterpreterSelectedAndNoOtherInterpretersDiagnostic = 'MacInterpreterSelectedAndNoOtherInterpretersDiagnostic',
    MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic = 'MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic',
    InvalidPythonPathInDebuggerSettingsDiagnostic = 'InvalidPythonPathInDebuggerSettingsDiagnostic',
    InvalidPythonPathInDebuggerLaunchDiagnostic = 'InvalidPythonPathInDebuggerLaunchDiagnostic',
    EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic = 'EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic',
    NoCurrentlySelectedPythonInterpreterDiagnostic = 'InvalidPythonInterpreterDiagnostic',
    LSNotSupportedDiagnostic = 'LSNotSupportedDiagnostic',
    PythonPathDeprecatedDiagnostic = 'PythonPathDeprecatedDiagnostic',
    JustMyCodeDiagnostic = 'JustMyCodeDiagnostic',
    ConsoleTypeDiagnostic = 'ConsoleTypeDiagnostic',
    ConfigPythonPathDiagnostic = 'ConfigPythonPathDiagnostic',
    UpgradeCodeRunnerDiagnostic = 'UpgradeCodeRunnerDiagnostic',
    PylanceDefaultDiagnostic = 'PylanceDefaultDiagnostic',
    JediPython27NotSupportedDiagnostic = 'JediPython27NotSupportedDiagnostic',
    SwitchToDefaultLanguageServerDiagnostic = 'SwitchToDefaultLanguageServerDiagnostic',
}
