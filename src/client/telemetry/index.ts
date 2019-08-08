// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable:no-reference no-any import-name no-any function-name
/// <reference path="./vscode-extension-telemetry.d.ts" />
import { JSONObject } from '@phosphor/coreutils';
import { basename as pathBasename, sep as pathSep } from 'path';
import * as stackTrace from 'stack-trace';
import TelemetryReporter from 'vscode-extension-telemetry';

import { IWorkspaceService } from '../common/application/types';
import { AppinsightsKey, EXTENSION_ROOT_DIR, isTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import { traceInfo } from '../common/logger';
import { StopWatch } from '../common/utils/stopWatch';
import { Telemetry } from '../datascience/constants';
import { ConsoleType } from '../debugger/types';
import { LinterId } from '../linters/types';
import { TestProvider } from '../testing/common/types';
import { EventName } from './constants';
import {
    DebuggerConfigurationPromtpsTelemetry,
    DiagnosticsAction,
    DiagnosticsMessages,
    EditorLoadTelemetry,
    FormatTelemetry,
    InterpreterActivation,
    InterpreterActivationEnvironmentVariables,
    InterpreterAutoSelection,
    LanguageServePlatformSupported,
    LanguageServerErrorTelemetry,
    LanguageServerVersionTelemetry,
    LinterInstallPromptTelemetry,
    LinterSelectionTelemetry,
    LintingTelemetry,
    Platform,
    PythonInterpreterTelemetry,
    TerminalTelemetry,
    TestConfiguringTelemetry,
    TestDiscoverytTelemetry,
    TestRunTelemetry
} from './types';

/**
 * Checks whether telemetry is supported.
 * Its possible this function gets called within Debug Adapter, vscode isn't available in there.
 * Withiin DA, there's a completely different way to send telemetry.
 * @returns {boolean}
 */
function isTelemetrySupported(): boolean {
    try {
        // tslint:disable-next-line:no-require-imports
        const vsc = require('vscode');
        // tslint:disable-next-line:no-require-imports
        const reporter = require('vscode-extension-telemetry');
        return vsc !== undefined && reporter !== undefined;
    } catch {
        return false;
    }
}

/**
 * Checks if the telemetry is disabled in user settings
 * @returns {boolean}
 */
export function isTelemetryDisabled(workspaceService: IWorkspaceService): boolean {
    const settings = workspaceService.getConfiguration('telemetry').inspect<boolean>('enableTelemetry')!;
    return settings.globalValue === false ? true : false;
}

let telemetryReporter: TelemetryReporter | undefined;
function getTelemetryReporter() {
    if (!isTestExecution() && telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = PVSC_EXTENSION_ID;
    // tslint:disable-next-line:no-require-imports
    const extensions = (require('vscode') as typeof import('vscode')).extensions;
    // tslint:disable-next-line:no-non-null-assertion
    const extension = extensions.getExtension(extensionId)!;
    // tslint:disable-next-line:no-unsafe-any
    const extensionVersion = extension.packageJSON.version;

    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    return (telemetryReporter = new reporter(extensionId, extensionVersion, AppinsightsKey));
}

export function clearTelemetryReporter() {
    telemetryReporter = undefined;
}

export function sendTelemetryEvent<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    durationMs?: Record<string, number> | number,
    properties?: P[E],
    ex?: Error
) {
    if (isTestExecution() || !isTelemetrySupported()) {
        return;
    }
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : durationMs ? durationMs : undefined;

    if (ex && (eventName as any) !== 'ERROR') {
        // When sending `ERROR` telemetry event no need to send custom properties.
        // Else we have to review all properties every time as part of GDPR.
        // Assume we have 10 events all with their own properties.
        // As we have errors for each event, those properties are treated as new data items.
        // Hence they need to be classified as part of the GDPR process, and thats unnecessary and onerous.
        const props: Record<string, string> = {};
        props.stackTrace = getStackTrace(ex);
        props.originalEventName = eventName as any as string;
        reporter.sendTelemetryEvent('ERROR', props, measures);
    }
    const customProperties: Record<string, string> = {};
    if (properties) {
        // tslint:disable-next-line:prefer-type-cast no-any
        const data = properties as any;
        Object.getOwnPropertyNames(data).forEach(prop => {
            if (data[prop] === undefined || data[prop] === null) {
                return;
            }
            // tslint:disable-next-line:prefer-type-cast no-any  no-unsafe-any
            (customProperties as any)[prop] = typeof data[prop] === 'string' ? data[prop] : data[prop].toString();
        });
    }
    reporter.sendTelemetryEvent((eventName as any) as string, customProperties, measures);
    if (process.env && process.env.VSC_PYTHON_LOG_TELEMETRY) {
        traceInfo(`Telemetry Event : ${eventName} Measures: ${JSON.stringify(measures)} Props: ${JSON.stringify(customProperties)} `);
    }
}

// tslint:disable-next-line:no-any function-name
export function captureTelemetry<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    properties?: P[E],
    captureDuration: boolean = true,
    failureEventName?: E
) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_target: Object, _propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            if (!captureDuration) {
                sendTelemetryEvent(eventName, undefined, properties);
                // tslint:disable-next-line:no-invalid-this
                return originalMethod.apply(this, args);
            }

            const stopWatch = new StopWatch();
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then(data => {
                        sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                        return data;
                    })
                    // tslint:disable-next-line:promise-function-async
                    .catch(ex => {
                        // tslint:disable-next-line:no-any
                        properties = properties || ({} as any);
                        (properties as any).failed = true;
                        sendTelemetryEvent(
                            failureEventName ? failureEventName : eventName,
                            stopWatch.elapsedTime,
                            properties,
                            ex
                        );
                    });
            } else {
                sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            }

            return result;
        };

        return descriptor;
    };
}

// function sendTelemetryWhenDone<T extends IDSMappings, K extends keyof T>(eventName: K, properties?: T[K]);
export function sendTelemetryWhenDone<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    promise: Promise<any> | Thenable<any>,
    stopWatch?: StopWatch,
    properties?: P[E]
) {
    stopWatch = stopWatch ? stopWatch : new StopWatch();
    if (typeof promise.then === 'function') {
        // tslint:disable-next-line:prefer-type-cast no-any
        (promise as Promise<any>).then(
            data => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return data;
                // tslint:disable-next-line:promise-function-async
            },
            ex => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties, ex);
                return Promise.reject(ex);
            }
        );
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}

function sanitizeFilename(filename: string): string {
    if (filename.startsWith(EXTENSION_ROOT_DIR)) {
        filename = `<pvsc>${filename.substring(EXTENSION_ROOT_DIR.length)}`;
    } else {
        // We don't really care about files outside our extension.
        filename = `<hidden>${pathSep}${pathBasename(filename)}`;
    }
    return filename;
}

function sanitizeName(name: string): string {
    if (name.indexOf('/') === -1 && name.indexOf('\\') === -1) {
        return name;
    } else {
        return '<hidden>';
    }
}

function getStackTrace(ex: Error): string {
    // We aren't showing the error message (ex.message) since it might
    // contain PII.
    let trace = '';
    for (const frame of stackTrace.parse(ex)) {
        let filename = frame.getFileName();
        if (filename) {
            filename = sanitizeFilename(filename);
            const lineno = frame.getLineNumber();
            const colno = frame.getColumnNumber();
            trace += `\n\tat ${getCallsite(frame)} ${filename}:${lineno}:${colno}`;
        } else {
            trace += '\n\tat <anonymous>';
        }
    }
    // Ensure we always use `/` as path seperators.
    // This way stack traces (with relative paths) comming from different OS will always look the same.
    return trace.trim().replace(/\\/g, '/');
}

function getCallsite(frame: stackTrace.StackFrame) {
    const parts: string[] = [];
    if (typeof frame.getTypeName() === 'string' && frame.getTypeName().length > 0) {
        parts.push(frame.getTypeName());
    }
    if (typeof frame.getMethodName() === 'string' && frame.getMethodName().length > 0) {
        parts.push(frame.getMethodName());
    }
    if (typeof frame.getFunctionName() === 'string' && frame.getFunctionName().length > 0) {
        if (parts.length !== 2 || parts.join('.') !== frame.getFunctionName()) {
            parts.push(frame.getFunctionName());
        }
    }
    return parts.map(sanitizeName).join('.');
}

// Map all events to their properties
export interface IEventNamePropertyMapping {
    [EventName.COMPLETION]: never | undefined;
    [EventName.COMPLETION_ADD_BRACKETS]: { enabled: boolean };
    /**
     * Telemetry captured when staring the debugger.
     */
    [EventName.DEBUGGER]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {('launch' | 'attach' | 'test')}
         */
        trigger: 'launch' | 'attach' | 'test';
        /**
         * Type of console used.
         *  -`internalConsole`: Use VS Code debug console (no shells/terminals).
         * - `integratedTerminal`: Use VS Code terminal.
         * - `externalTerminal`: Use an External terminal.
         *
         * @type {ConsoleType}
         */
        console?: ConsoleType;
        /**
         * Whether user has defined environment variables.
         * Could have been defined in launch.json or the env file (defined in `settings.json`).
         * Default `env file` is `.env` in the workspace folder.
         *
         * @type {boolean}
         */
        hasEnvVars: boolean;
        /**
         * Whether there are any CLI arguments that need to be passed into the program being debugged.
         *
         * @type {boolean}
         */
        hasArgs: boolean;
        /**
         * Whether the user is debugging `django`.
         *
         * @type {boolean}
         */
        django: boolean;
        /**
         * Whether the user is debugging `flask`.
         *
         * @type {boolean}
         */
        flask: boolean;
        /**
         * Whether the user is debugging `jinja` templates.
         *
         * @type {boolean}
         */
        jinja: boolean;
        /**
         * Whether user is attaching to a local python program (attach scenario).
         *
         * @type {boolean}
         */
        isLocalhost: boolean;
        /**
         * Whether debugging a module.
         *
         * @type {boolean}
         */
        isModule: boolean;
        /**
         * Whether debugging with `sudo`.
         *
         * @type {boolean}
         */
        isSudo: boolean;
        /**
         * Whether required to stop upon entry.
         *
         * @type {boolean}
         */
        stopOnEntry: boolean;
        /**
         * Whether required to display return types in debugger.
         *
         * @type {boolean}
         */
        showReturnValue: boolean;
        /**
         * Whether debugging `pyramid`.
         *
         * @type {boolean}
         */
        pyramid: boolean;
        /**
         * Whether debugging a subprocess.
         *
         * @type {boolean}
         */
        subProcess: boolean;
        /**
         * Whether debugging `watson`.
         *
         * @type {boolean}
         */
        watson: boolean;
        /**
         * Whether degbugging `pyspark`.
         *
         * @type {boolean}
         */
        pyspark: boolean;
        /**
         * Whether using `gevent` when deugging.
         *
         * @type {boolean}
         */
        gevent: boolean;
        /**
         * Whether debugging `scrapy`.
         *
         * @type {boolean}
         */
        scrapy: boolean;
    };
    [EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS]: never | undefined;
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS]: DebuggerConfigurationPromtpsTelemetry;
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS_IN_LAUNCH_JSON]: never | undefined;
    [EventName.DEFINITION]: never | undefined;
    /**
     * Telemetry event sent with details of actions when invoking a diagnostic command
     */
    [EventName.DIAGNOSTICS_ACTION]: DiagnosticsAction;
    /**
     * Telemetry event sent when we are checking if we can handle the diagnostic code
     */
    [EventName.DIAGNOSTICS_MESSAGE]: DiagnosticsMessages;
    [EventName.EDITOR_LOAD]: EditorLoadTelemetry;
    [EventName.ENVFILE_VARIABLE_SUBSTITUTION]: never | undefined;
    /**
     * Telemetry Event sent when user sends code to be executed in the terminal.
     *
     */
    [EventName.EXECUTION_CODE]: {
        /**
         * Whether the user executed a file in the terminal or just the selected text.
         *
         * @type {('file' | 'selection')}
         */
        scope: 'file' | 'selection';
        /**
         * How was the code executed (through the command or by clicking the `Run File` icon).
         *
         * @type {('command' | 'icon')}
         */
        trigger?: 'command' | 'icon';
    };
    /**
     * Telemetry Event sent when user executes code against Django Shell.
     * Values sent:
     * scope
     *
     */
    [EventName.EXECUTION_DJANGO]: {
        /**
         * If `file`, then the file was executed in the django shell.
         * If `selection`, then the selected text was sent to the django shell.
         *
         * @type {('file' | 'selection')}
         */
        scope: 'file' | 'selection';
    };
    [EventName.FORMAT]: FormatTelemetry;
    [EventName.FORMAT_ON_TYPE]: { enabled: boolean };
    [EventName.FORMAT_SORT_IMPORTS]: never | undefined;
    [EventName.GO_TO_OBJECT_DEFINITION]: never | undefined;
    [EventName.HOVER_DEFINITION]: never | undefined;
    [EventName.HASHED_PACKAGE_NAME]: { hashedName: string };
    [EventName.HASHED_PACKAGE_PERF]: never | undefined;
    /**
     * Telemetry event sent with details of selection in prompt
     * `Prompt message` :- 'Linter ${productName} is not installed'
     */
    [EventName.LINTER_NOT_INSTALLED_PROMPT]: LinterInstallPromptTelemetry;
    [EventName.PYTHON_INSTALL_PACKAGE]: { installer: string };
    [EventName.LINTING]: LintingTelemetry;
    [EventName.PLATFORM_INFO]: Platform;
    [EventName.PYTHON_INTERPRETER]: PythonInterpreterTelemetry;
    [EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES]: InterpreterActivationEnvironmentVariables;
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_RUNNING_CODE]: InterpreterActivation;
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_TERMINAL]: InterpreterActivation;
    [EventName.PYTHON_INTERPRETER_AUTO_SELECTION]: InterpreterAutoSelection;
    /**
     * Sends information regarding discovered python environments (virtualenv, conda, pipenv etc.)
     */
    [EventName.PYTHON_INTERPRETER_DISCOVERY]: {
        /**
         * Name of the locator
         */
        locator: string;
        /**
         * The number of the interpreters returned by locator
         */
        interpreters?: number;
    };
    [EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT]: { selection: 'Yes' | 'No' | 'Ignore' | undefined };
    /**
     * Telemetry event sent with details when user clicks a button in the virtual environment prompt.
     * `Prompt message` :- 'We noticed a new virtual environment has been created. Do you want to select it for the workspace folder?'
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT]: {
        /**
         * `Yes` When 'Yes' option is selected
         * `No` When 'No' option is selected
         * `Ignore` When 'Do not show again' option is clicked
         *
         * @type {('Yes' | 'No' | 'Ignore' | undefined)}
         */
        selection: 'Yes' | 'No' | 'Ignore' | undefined;
    };
    [EventName.INSIDERS_PROMPT]: {
        /**
         * @type {'Yes, weekly'} When user selects to use "weekly" as extension channel in insiders prompt
         * @type {'Yes, daily'} When user selects to use "daily" as extension channel in insiders prompt
         * @type {'No, thanks'} When user decides to keep using the same extension channel as before
         *
         * @type {('Yes, weekly' | 'Yes, daily' | 'No, thanks' | undefined)}
         */
        selection: 'Yes, weekly' | 'Yes, daily' | 'No, thanks' | undefined;
    };
    /**
     * Telemetry event sent with details when user clicks a button in the 'Reload to install insiders prompt'.
     * `Prompt message` :- 'Please reload Visual Studio Code to use the insiders build of the extension'
     */
    [EventName.INSIDERS_RELOAD_PROMPT]: {
        /**
         * `Reload` When 'Reload' option is clicked
         * `undefined` When prompt is closed
         *
         * @type {('Reload' | undefined)}
         */
        selection: 'Reload' | undefined;
    };
    /**
     * Telemetry tracking switching between LS and Jedi
     */
    [EventName.PYTHON_LANGUAGE_SERVER_SWITCHED]: { change: 'Switch to Jedi from LS' | 'Switch to LS from Jedi' };
    /**
     * Telemetry event sent with details after attempting to download LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_DOWNLOADED]: LanguageServerVersionTelemetry;
    /**
     * Telemetry event sent when LS is started for workspace (workspace folder in case of multi-root)
     */
    [EventName.PYTHON_LANGUAGE_SERVER_ENABLED]: never | undefined;
    /**
     * Telemetry event sent with details when downloading or extracting LS fails
     */
    [EventName.PYTHON_LANGUAGE_SERVER_ERROR]: LanguageServerErrorTelemetry;
    /**
     * Telemetry event sent with details after attempting to extract LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_EXTRACTED]: LanguageServerVersionTelemetry;
    /**
     * Telemetry event sent if azure blob packages are being listed
     */
    [EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES]: never | undefined;
    /**
     * Tracks if LS is supported on platform or not
     */
    [EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED]: LanguageServePlatformSupported;
    /**
     * Telemetry event sent when LS is ready to start
     */
    [EventName.PYTHON_LANGUAGE_SERVER_READY]: never | undefined;
    /**
     * Telemetry event sent when starting LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_STARTUP]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_TELEMETRY]: any;
    [EventName.PYTHON_EXPERIMENTS]: {
        /**
         * Name of the experiment group the user is in
         * @type {string}
         */
        expName?: string;
    };
    [EventName.PYTHON_EXPERIMENTS_DOWNLOAD_SUCCESS_RATE]: {
        /**
         * Carries `true` if downloading experiments successfully finishes within timeout, `false` otherwise
         * @type {boolean}
         */
        success?: boolean;
        /**
         * Carries an error string if downloading experiments fails with error
         * @type {string}
         */
        error?: string;
    };
    /**
     * When user clicks a button in the python extension survey prompt, this telemetry event is sent with details
     */
    [EventName.EXTENSION_SURVEY_PROMPT]: {
        /**
         * Carries the selection of user when they are asked to take the extension survey
         */
        selection: 'Yes' | 'Maybe later' | 'Do not show again' | undefined;
    };
    [EventName.REFACTOR_EXTRACT_FUNCTION]: never | undefined;
    [EventName.REFACTOR_EXTRACT_VAR]: never | undefined;
    [EventName.REFACTOR_RENAME]: never | undefined;
    [EventName.REFERENCE]: never | undefined;
    [EventName.REPL]: never | undefined;
    /**
     * Telemetry event sent with details of linter selected in quickpick of linter list.
     */
    [EventName.SELECT_LINTER]: LinterSelectionTelemetry;
    /**
     * Telemetry event sent with details when clicking the prompt with the following message,
     * `Prompt message` :- 'You have a pylintrc file in your workspace. Do you want to enable pylint?'
     */
    [EventName.CONFIGURE_AVAILABLE_LINTER_PROMPT]: {
        /**
         * Name of the linter tool
         *
         * @type {LinterId}
         */
        tool: LinterId;
        /**
         * `enable` When 'Enable [linter name]' option is clicked
         * `ignore` When 'Not now' option is clicked
         * `disablePrompt` When 'Do not show again` option is clicked
         *
         * @type {('enable' | 'ignore' | 'disablePrompt' | undefined)}
         */
        action: 'enable' | 'ignore' | 'disablePrompt' | undefined;
    };
    [EventName.SIGNATURE]: never | undefined;
    [EventName.SYMBOL]: never | undefined;
    [EventName.UNITTEST_CONFIGURE]: never | undefined;
    [EventName.UNITTEST_CONFIGURING]: TestConfiguringTelemetry;
    [EventName.TERMINAL_CREATE]: TerminalTelemetry;
    [EventName.UNITTEST_DISCOVER]: TestDiscoverytTelemetry;
    [EventName.UNITTEST_DISCOVER_WITH_PYCODE]: never | undefined;
    [EventName.UNITTEST_NAVIGATE]: { byFile?: boolean; byFunction?: boolean; bySuite?: boolean; focus_code?: boolean };
    [EventName.UNITTEST_EXPLORER_WORK_SPACE_COUNT]: { count: number };
    /**
     * Telemetry event sent with details about running the tests, what is being run, what framework is being used etc.
     */
    [EventName.UNITTEST_RUN]: TestRunTelemetry;
    /**
     * Telemetry event sent when cancelling running or discovering tests
     */
    [EventName.UNITTEST_STOP]: never | undefined;
    /**
     * Telemetry event sent when disabling all test frameworks
     */
    [EventName.UNITTEST_DISABLE]: never | undefined;
    /**
     * Telemetry event sent when viewing Python test log output
     */
    [EventName.UNITTEST_VIEW_OUTPUT]: never | undefined;
    /**
     * Tracks which testing framework has been enabled by the user.
     * Telemetry is sent when settings have been modified by the user.
     * Values sent include:
     * unittest -   If this value is `true`, then unittest has been enabled by the user.
     * pytest   -   If this value is `true`, then pytest has been enabled by the user.
     * nosetest -   If this value is `true`, then nose has been enabled by the user.
     * @type {(never | undefined)}
     * @memberof IEventNamePropertyMapping
     */
    [EventName.UNITTEST_ENABLED]: Partial<Record<TestProvider, undefined | boolean>>;
    [EventName.UPDATE_PYSPARK_LIBRARY]: never | undefined;
    [EventName.WORKSPACE_SYMBOLS_BUILD]: never | undefined;
    [EventName.WORKSPACE_SYMBOLS_GO_TO]: never | undefined;
    // Data Science
    [Telemetry.AddCellBelow]: never | undefined;
    [Telemetry.ClassConstructionTime]: { class: string };
    [Telemetry.CodeLensAverageAcquisitionTime]: never | undefined;
    [Telemetry.CollapseAll]: never | undefined;
    [Telemetry.ConnectFailedJupyter]: never | undefined;
    [Telemetry.ConnectLocalJupyter]: never | undefined;
    [Telemetry.ConnectRemoteJupyter]: never | undefined;
    [Telemetry.ConnectRemoteFailedJupyter]: never | undefined;
    [Telemetry.ConnectRemoteSelfCertFailedJupyter]: never | undefined;
    [Telemetry.CopySourceCode]: never | undefined;
    [Telemetry.DataScienceSettings]: JSONObject;
    [Telemetry.DataViewerFetchTime]: never | undefined;
    [Telemetry.DebugContinue]: never | undefined;
    [Telemetry.DebugCurrentCell]: never | undefined;
    [Telemetry.DebugStepOver]: never | undefined;
    [Telemetry.DebugStop]: never | undefined;
    [Telemetry.DebugFileInteractive]: never | undefined;
    [Telemetry.DeleteAllCells]: never | undefined;
    [Telemetry.DeleteCell]: never | undefined;
    [Telemetry.FindJupyterCommand]: { command: string };
    [Telemetry.FindJupyterKernelSpec]: never | undefined;
    [Telemetry.DisableInteractiveShiftEnter]: never | undefined;
    [Telemetry.EnableInteractiveShiftEnter]: never | undefined;
    [Telemetry.ExecuteCell]: never | undefined;
    [Telemetry.ExecuteCellPerceivedCold]: never | undefined;
    [Telemetry.ExecuteCellPerceivedWarm]: never | undefined;
    [Telemetry.ExpandAll]: never | undefined;
    [Telemetry.ExportNotebook]: never | undefined;
    [Telemetry.ExportPythonFile]: never | undefined;
    [Telemetry.ExportPythonFileAndOutput]: never | undefined;
    [Telemetry.GetPasswordAttempt]: never | undefined;
    [Telemetry.GetPasswordFailure]: never | undefined;
    [Telemetry.GetPasswordSuccess]: never | undefined;
    [Telemetry.GotoSourceCode]: never | undefined;
    [Telemetry.HiddenCellTime]: never | undefined;
    [Telemetry.ImportNotebook]: { scope: 'command' | 'file' };
    [Telemetry.Interrupt]: never | undefined;
    [Telemetry.InterruptJupyterTime]: never | undefined;
    [Telemetry.PandasNotInstalled]: never | undefined;
    [Telemetry.PandasTooOld]: never | undefined;
    [Telemetry.PtvsdInstallFailed]: never | undefined;
    [Telemetry.PtvsdPromptToInstall]: never | undefined;
    [Telemetry.PtvsdSuccessfullyInstalled]: never | undefined;
    [Telemetry.OpenPlotViewer]: never | undefined;
    [Telemetry.Redo]: never | undefined;
    [Telemetry.RemoteAddCode]: never | undefined;
    [Telemetry.RestartJupyterTime]: never | undefined;
    [Telemetry.RestartKernel]: never | undefined;
    [Telemetry.RunAllCells]: never | undefined;
    [Telemetry.RunSelectionOrLine]: never | undefined;
    [Telemetry.RunCell]: never | undefined;
    [Telemetry.RunCurrentCell]: never | undefined;
    [Telemetry.RunAllCellsAbove]: never | undefined;
    [Telemetry.RunCellAndAllBelow]: never | undefined;
    [Telemetry.RunCurrentCellAndAdvance]: never | undefined;
    [Telemetry.RunToLine]: never | undefined;
    [Telemetry.RunFileInteractive]: never | undefined;
    [Telemetry.RunFromLine]: never | undefined;
    [Telemetry.ScrolledToCell]: never | undefined;
    [Telemetry.SelfCertsMessageClose]: never | undefined;
    [Telemetry.SelfCertsMessageEnabled]: never | undefined;
    [Telemetry.SelectJupyterURI]: never | undefined;
    [Telemetry.SetJupyterURIToLocal]: never | undefined;
    [Telemetry.SetJupyterURIToUserSpecified]: never | undefined;
    [Telemetry.ShiftEnterBannerShown]: never | undefined;
    [Telemetry.ShowDataViewer]: { rows: number | undefined; columns: number | undefined };
    [Telemetry.ShowHistoryPane]: never | undefined;
    [Telemetry.StartJupyter]: never | undefined;
    [Telemetry.StartJupyterProcess]: never | undefined;
    [Telemetry.SubmitCellThroughInput]: never | undefined;
    [Telemetry.Undo]: never | undefined;
    [Telemetry.VariableExplorerFetchTime]: never | undefined;
    [Telemetry.VariableExplorerToggled]: { open: boolean };
    [Telemetry.VariableExplorerVariableCount]: { variableCount: number };
    [Telemetry.WaitForIdleJupyter]: never | undefined;
    [Telemetry.WebviewMonacoStyleUpdate]: never | undefined;
    [Telemetry.WebviewStartup]: { type: string };
    [Telemetry.WebviewStyleUpdate]: never | undefined;
    /*
    Telemetry event sent with details of Jedi Memory usage.
    mem_use - Memory usage of Process in kb.
    limit - Upper bound for memory usage of Jedi process.
    isUserDefinedLimit - Whether the user has configfured the upper bound limit.
    restart - Whether to restart the Jedi Process (i.e. memory > limit).
    */
    [EventName.JEDI_MEMORY]: { mem_use: number; limit: number; isUserDefinedLimit: boolean; restart: boolean };
    /*
    Telemetry event sent to provide information on whether we have successfully identify the type of shell used.
    This information is useful in determining how well we identify shells on users machines.
    This impacts executing code in terminals and activation of environments in terminal.
    So, the better this works, the better it is for the user.
    failed - If true, indicates we have failed to identify the shell. Note this impacts impacts ability to activate environments in the terminal & code.
    shellIdentificationSource - How was the shell identified. One of 'terminalName' | 'settings' | 'environment' | 'default'
                                If terminalName, then this means we identified the type of the shell based on the name of the terminal.
                                If settings, then this means we identified the type of the shell based on user settings in VS Code.
                                If environment, then this means we identified the type of the shell based on their environment (env variables, etc).
                                    I.e. their default OS Shell.
                                If default, then we reverted to OS defaults (cmd on windows, and bash on the rest).
                                    This is the worst case scenario.
                                    I.e. we could not identify the shell at all.
    terminalProvided - If true, we used the terminal provided to detec the shell. If not provided, we use the default shell on user machine.
    hasCustomShell - If undefined (not set), we didn't check.
                     If true, user has customzied their shell in VSC Settings.
    hasShellInEnv - If undefined (not set), we didn't check.
                    If true, user has a shell in their environment.
                    If false, user does not have a shell in their environment.
    */
    [EventName.TERMINAL_SHELL_IDENTIFICATION]: {
        failed: boolean;
        terminalProvided: boolean;
        shellIdentificationSource: 'terminalName' | 'settings' | 'environment' | 'default' | 'vscode';
        hasCustomShell: undefined | boolean;
        hasShellInEnv: undefined | boolean;
    };
}
