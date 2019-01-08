// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { TerminalShellType } from '../common/terminal/types';
import { DebugConfigurationType } from '../debugger/extension/types';
import { AutoSelectionRule } from '../interpreter/autoSelection/types';
import { InterpreterType } from '../interpreter/contracts';
import { LinterId } from '../linters/types';
import { PlatformErrors } from './constants';

export type EditorLoadTelemetry = {
    condaVersion: string | undefined;
    terminal: TerminalShellType;
    hasUserDefinedInterpreter: boolean;
    isAutoSelectedWorkspaceInterpreterUsed: boolean;
};
export type FormatTelemetry = {
    tool: 'autopep8' | 'black' | 'yapf';
    hasCustomArgs: boolean;
    formatSelection: boolean;
};

export type LanguageServerVersionTelemetry = {
    success: boolean;
    lsVersion?: string;
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

export type LinterInstallPromptTelemetry = {
    tool?: LinterId;
    action: 'select'|'disablePrompt'|'install';
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
export type CodeExecutionTelemetry = {
    scope: 'file' | 'selection';
};
export type DebuggerTelemetry = {
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
    showReturnValue: boolean;
    pyramid: boolean;
    subProcess: boolean;
    watson: boolean;
    pyspark: boolean;
    gevent: boolean;
    scrapy: boolean;
};
export type DebuggerPerformanceTelemetry = {
    duration: number;
    action: 'stepIn' | 'stepOut' | 'continue' | 'next' | 'launch';
};
export type TestRunTelemetry = {
    tool: 'nosetest' | 'pytest' | 'unittest';
    scope: 'currentFile' | 'all' | 'file' | 'class' | 'function' | 'failed';
    debugging: boolean;
    triggerSource: 'ui' | 'codelens' | 'commandpalette' | 'auto';
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
export type SettingsTelemetry = {
    enabled: boolean;
};
export type TerminalTelemetry = {
    terminal?: TerminalShellType;
    triggeredBy?: 'commandpalette';
    pythonVersion?: string;
    interpreterType?: InterpreterType;
};
export type DebuggerConfigurationPromtpsTelemetry = {
    configurationType: DebugConfigurationType;
    autoDetectedDjangoManagePyPath?: boolean;
    autoDetectedPyramidIniPath?: boolean;
    autoDetectedFlaskAppPyPath?: boolean;
    manuallyEnteredAValue?: boolean;
};
export type DiagnosticsAction = {
    /**
     * Diagnostics command executed.
     * @type {string}
     */
    commandName?: string;
    /**
     * Diagnostisc code ignored (message will not be seen again).
     * @type {string}
     */
    ignoreCode?: string;
    /**
     * Url of web page launched in browser.
     * @type {string}
     */
    url?: string;
    /**
     * Custom actions performed.
     * @type {'switchToCommandPrompt'}
     */
    action?: 'switchToCommandPrompt';
};
export type DiagnosticsMessages = {
    /**
     * Code of diagnostics message detected and displayed.
     * @type {string}
     */
    code: string;
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
export type InterpreterDiscovery = {
    locator: string;
};

export type TelemetryProperties = FormatTelemetry
    | LanguageServerVersionTelemetry
    | LanguageServerErrorTelemetry
    | LintingTelemetry
    | LinterInstallPromptTelemetry
    | LinterSelectionTelemetry
    | EditorLoadTelemetry
    | PythonInterpreterTelemetry
    | CodeExecutionTelemetry
    | TestRunTelemetry
    | TestDiscoverytTelemetry
    | FeedbackTelemetry
    | TerminalTelemetry
    | DebuggerTelemetry
    | SettingsTelemetry
    | DiagnosticsAction
    | DiagnosticsMessages
    | ImportNotebook
    | Platform
    | LanguageServePlatformSupported
    | DebuggerConfigurationPromtpsTelemetry
    | InterpreterAutoSelection
    | InterpreterDiscovery;
