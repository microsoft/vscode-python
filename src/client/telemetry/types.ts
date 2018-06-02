// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TerminalShellType } from '../common/terminal/types';
import { InterpreterType } from '../interpreter/contracts';
import { LinterId } from '../linters/types';

export type EditorLoadTelemetry = {
    condaVersion: string | undefined;
    terminal: TerminalShellType;
};
export type FormatTelemetry = {
    tool: 'autopep8' | 'black' | 'yapf';
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
    trigger: 'launch' | 'attach';
    console?: 'none' | 'integratedTerminal' | 'externalTerminal';
    debugOptions?: string;
    pyspark?: boolean;
    hasEnvVars?: boolean;
};
export type DebuggerTelemetryV2 = {
    trigger: 'launch' | 'attach';
    console?: 'none' | 'integratedTerminal' | 'externalTerminal';
    hasEnvVars: boolean;
    hasArgs: boolean;
    django: boolean;
    flask: boolean;
    jinja: boolean;
    isLocalhost: boolean;
    isModule: boolean;
    isSudo: boolean;
    stopOnEntry: boolean;
    pyramid: boolean;
};
export type DebuggerPerformanceTelemetry = {
    duration: number;
    action: 'stepIn' | 'stepOut' | 'continue' | 'next' | 'launch';
};
export type TestRunTelemetry = {
    tool: 'nosetest' | 'pytest' | 'unittest';
    scope: 'currentFile' | 'all' | 'file' | 'class' | 'function' | 'failed';
    debugging: boolean;
    triggeredBy: 'ui' | 'codelens' | 'commandpalette' | 'auto';
    failed: boolean;
};
export type TestDiscoverytTelemetry = {
    tool: 'nosetest' | 'pytest' | 'unittest';
    trigger: 'ui' | 'commandpalette';
    failed: boolean;
};
export type FeedbackTelemetry = {
    action: 'accepted' | 'dismissed' | 'doNotShowAgain';
};
export type TerminalTelemetry = {
    terminal?: TerminalShellType;
    triggeredBy?: 'commandpalette';
    pythonVersion?: string;
    interpreterType?: InterpreterType;
};
export type TelemetryProperties = FormatTelemetry | LintingTelemetry | EditorLoadTelemetry | PythonInterpreterTelemetry | CodeExecutionTelemetry | TestRunTelemetry | TestDiscoverytTelemetry | FeedbackTelemetry | TerminalTelemetry | DebuggerTelemetryV2;
