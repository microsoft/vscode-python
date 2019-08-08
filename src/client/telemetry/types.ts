// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { DiagnosticCodes } from '../application/diagnostics/constants';
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

export type LanguageServerVersionTelemetry = {
    /**
     * Whether LS downloading/extracting succeeds
     */
    success: boolean;
    /**
     * Version of LS downloaded/extracted
     */
    lsVersion?: string;
    /**
     * Whether download uri starts with `https:` or not
     */
    usedSSL?: boolean;
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
    /**
     * Name of the linter
     *
     * @type {LinterId}
     */
    tool?: LinterId;
    /**
     * `select` When 'Select linter' option is selected
     * `disablePrompt` When 'Do not show again' option is selected
     * `install` When 'Install' option is selected
     *
     * @type {('select' | 'disablePrompt' | 'install')}
     */
    action: 'select' | 'disablePrompt' | 'install';
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
export type TestRunTelemetry = {
    /**
     * Framework being used to run tests
     */
    tool: TestTool;
    /**
     * Carries info what is being run
     */
    scope: 'currentFile' | 'all' | 'file' | 'class' | 'function' | 'failed';
    /**
     * Carries `true` if debugging, `false` otherwise
     */
    debugging: boolean;
    /**
     * Carries what triggered the execution of the tests
     */
    triggerSource: 'ui' | 'codelens' | 'commandpalette' | 'auto' | 'testExplorer';
    /**
     * Carries `true` if running tests failed, `false` otherwise
     */
    failed: boolean;
};
export type TestDiscoverytTelemetry = {
    /**
     * The test framework used to discover tests
     *
     * @type {TestTool}
     */
    tool: TestTool;
    /**
     * Carries the source which triggered discovering of tests
     *
     * @type {('ui' | 'commandpalette')}
     */
    trigger: 'ui' | 'commandpalette';
    /**
     * Carries `true` if discovering tests failed, `false` otherwise
     *
     * @type {boolean}
     */
    failed: boolean;
};
export type TestConfiguringTelemetry = {
    /**
     * Name of the test framework to configure
     */
    tool?: TestTool;
    /**
     * Carries the source which triggered configuration of tests
     *
     * @type {('ui' | 'commandpalette')}
     */
    trigger: 'ui' | 'commandpalette';
    /**
     * Carries `true` if configuring test framework failed, `false` otherwise
     *
     * @type {boolean}
     */
    failed: boolean;
};
export type FeedbackTelemetry = {
    action: 'accepted' | 'dismissed' | 'doNotShowAgain';
};
export type SettingsTelemetry = {
    enabled: boolean;
};
export type TerminalTelemetry = {
    /**
     * The type of terminal shell created: powershell, cmd, zsh, bash etc.
     *
     * @type {TerminalShellType}
     */
    terminal?: TerminalShellType;
    /**
     * The source which triggered creation of terminal
     *
     * @type {'commandpalette'}
     */
    triggeredBy?: 'commandpalette';
    /**
     * The default Python interpreter version to be used in terminal, inferred from resource's 'settings.json'
     *
     * @type {string}
     */
    pythonVersion?: string;
    /**
     * The Python interpreter type: Conda, Virtualenv, Venv, Pipenv etc.
     *
     * @type {InterpreterType}
     */
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
    code: DiagnosticCodes;
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
