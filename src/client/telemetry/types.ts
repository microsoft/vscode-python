import { LinterId } from '../linters/types';

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export type EditorLoadTelemetry = {
    condaVersion: string;
};
export type FormatTelemetry = {
    tool: 'autoppep8' | 'yapf';
    hasCustomArgs: boolean;
    formatSelection: boolean;
};

export type LinterTrigger = 'auto' | 'save';

export type LintingTelemetry = {
    tool: LinterId;
    hasCustomArgs: boolean;
    trigger: LinterTrigger;
    executableSpecified: boolean;
};
export type PythonInterpreterTelemetry = {
    trigger: 'ui' | 'shebang' | 'load';
    failed: boolean;
    version?: string;
    pipVersion?: string;
};
export type CodeExecutionTelemetry = {
    scope: 'file' | 'selection';
};
export type DebuggerTelemetry = {
    trigger: 'launch' | 'attach'
    console?: 'none' | 'integratedTerminal' | 'externalTerminal';
    debugOptions?: string;
    pyspark?: boolean;
    hasEnvVars?: boolean;
};
export type DebuggerPerformanceTelemetry = {
    duration: number;
    action: 'stepIn' | 'stepOut' | 'continue' | 'next' | 'launch';
};
export type TestRunTelemetry = {
    tool: 'nosetest' | 'pytest' | 'unittest'
    scope: 'currentFile' | 'all' | 'file' | 'class' | 'function' | 'failed';
    debugging: boolean;
    trigger: 'ui' | 'codelens' | 'commandpalette' | 'auto';
    failed: boolean;
};
export type TestDiscoverytTelemetry = {
    tool: 'nosetest' | 'pytest' | 'unittest'
    trigger: 'ui' | 'commandpalette';
    failed: boolean;
};
export type FeedbackTelemetry = {
    action: 'accepted' | 'dismissed' | 'doNotShowAgain';
};
export type TelemetryProperties = FormatTelemetry | LintingTelemetry | EditorLoadTelemetry | PythonInterpreterTelemetry | CodeExecutionTelemetry | TestRunTelemetry | TestDiscoverytTelemetry | FeedbackTelemetry;
