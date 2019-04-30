// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export enum DiagnosticCodes {
    InvalidEnvironmentPathVariableDiagnostic = 'InvalidEnvironmentPathVariableDiagnostic',
    InvalidDebuggerTypeDiagnostic = 'InvalidDebuggerTypeDiagnostic',
    InvalidTestSettingDiagnostic = 'InvalidTestSettingDiagnostic',
    NoPythonInterpretersDiagnostic = 'NoPythonInterpretersDiagnostic',
    MacInterpreterSelectedAndNoOtherInterpretersDiagnostic = 'MacInterpreterSelectedAndNoOtherInterpretersDiagnostic',
    MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic = 'MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic',
    InvalidPythonPathInDebuggerSettingsDiagnostic = 'InvalidPythonPathInDebuggerSettingsDiagnostic',
    InvalidPythonPathInDebuggerLaunchDiagnostic = 'InvalidPythonPathInDebuggerLaunchDiagnostic',
    EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic = 'EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic',
    NoCurrentlySelectedPythonInterpreterDiagnostic = 'InvalidPythonInterpreterDiagnostic',
    LSNotSupportedDiagnostic = 'LSNotSupportedDiagnostic',
    JustMyCodeDiagnostic = 'JustMyCodeDiagnostic',
    ConsoleTypeDiagnostic = 'ConsoleTypeDiagnostic'
}
