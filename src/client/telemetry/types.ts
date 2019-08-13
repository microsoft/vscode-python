// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { TerminalShellType } from '../common/terminal/types';
import { DebugConfigurationType } from '../debugger/extension/types';
import { AutoSelectionRule } from '../interpreter/autoSelection/types';
import { InterpreterType } from '../interpreter/contracts';
import { LinterId } from '../linters/types';
import { IEventNamePropertyMapping } from '../telemetry/index';
import { EventName, PlatformErrors } from './constants';

export type EditorLoadTelemetry = {
    condaVersion: string | undefined;
    pythonVersion: string | undefined;
    interpreterType: InterpreterType | undefined;
    terminal: TerminalShellType;
    workspaceFolderCount: number;
    hasPython3: boolean;
    usingUserDefinedInterpreter: boolean;
    usingAutoSelectedWorkspaceInterpreter: boolean;
    usingGlobalInterpreter: boolean;
};
export type FormatTelemetry = {
    tool: 'autopep8' | 'black' | 'yapf';
    hasCustomArgs: boolean;
    formatSelection: boolean;
};

export type LanguageServerErrorTelemetry = {
    error: string;
};

export type LanguageServePlatformSupported = {
    supported: boolean;
    failureType?: 'UnknownError';
};

export type LinterTrigger = 'auto' | 'save';

export type LintingTelemetry = {
    tool: LinterId;
    hasCustomArgs: boolean;
    trigger: LinterTrigger;
    executableSpecified: boolean;
};

export type LinterSelectionTelemetry = {
    tool?: LinterId;
    enabled: boolean;
};

export type PythonInterpreterTelemetry = {
    trigger: 'ui' | 'shebang' | 'load';
    failed: boolean;
    pythonVersion?: string;
    pipVersion?: string;
};
export type CodeExecutionTelemetry = IEventNamePropertyMapping[EventName.EXECUTION_CODE];
export type DebuggerTelemetry = IEventNamePropertyMapping[EventName.DEBUGGER];
export type DebuggerPerformanceTelemetry = {
    duration: number;
    action: 'stepIn' | 'stepOut' | 'continue' | 'next' | 'launch';
};
export type TestTool = 'nosetest' | 'pytest' | 'unittest';
export type TestRunTelemetry = IEventNamePropertyMapping[EventName.UNITTEST_RUN];
export type TestDiscoverytTelemetry = IEventNamePropertyMapping[EventName.UNITTEST_DISCOVER];
export type TestConfiguringTelemetry = IEventNamePropertyMapping[EventName.UNITTEST_CONFIGURING];
export type FeedbackTelemetry = {
    action: 'accepted' | 'dismissed' | 'doNotShowAgain';
};
export type SettingsTelemetry = {
    enabled: boolean;
};
export type DebuggerConfigurationPromtpsTelemetry = {
    configurationType: DebugConfigurationType;
    autoDetectedDjangoManagePyPath?: boolean;
    autoDetectedPyramidIniPath?: boolean;
    autoDetectedFlaskAppPyPath?: boolean;
    manuallyEnteredAValue?: boolean;
};
export type ImportNotebook = {
    scope: 'command';
};

export type Platform = {
    failureType?: PlatformErrors;
    osVersion?: string;
};

export type InterpreterAutoSelection = {
    rule?: AutoSelectionRule;
    interpreterMissing?: boolean;
    identified?: boolean;
    updated?: boolean;
};

export type InterpreterActivationEnvironmentVariables = {
    hasEnvVars?: boolean;
    failed?: boolean;
};

export type InterpreterActivation = {
    hasCommands?: boolean;
    failed?: boolean;
    terminal: TerminalShellType;
    pythonVersion?: string;
    interpreterType: InterpreterType;
};

export const IImportTracker = Symbol('IImportTracker');
export interface IImportTracker {
    activate(): Promise<void>;
}
