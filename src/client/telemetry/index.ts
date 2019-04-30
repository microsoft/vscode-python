// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable:no-reference no-any import-name no-any function-name
/// <reference path="./vscode-extension-telemetry.d.ts" />
import { JSONObject } from '@phosphor/coreutils';
import { basename as pathBasename, sep as pathSep } from 'path';
import * as stackTrace from 'stack-trace';
import TelemetryReporter from 'vscode-extension-telemetry';

import { EXTENSION_ROOT_DIR, isTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import { StopWatch } from '../common/utils/stopWatch';
import { Telemetry } from '../datascience/constants';
import { LinterId } from '../linters/types';
import { EventName } from './constants';
import {
    CodeExecutionTelemetry,
    DebuggerConfigurationPromtpsTelemetry,
    DebuggerTelemetry,
    DiagnosticsAction,
    DiagnosticsMessages,
    EditorLoadTelemetry,
    FormatTelemetry,
    InterpreterActivation,
    InterpreterActivationEnvironmentVariables,
    InterpreterAutoSelection,
    InterpreterDiscovery,
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
    // tslint:disable-next-line:no-unsafe-any
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;

    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    return (telemetryReporter = new reporter(extensionId, extensionVersion, aiKey));
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

    // tslint:disable-next-line:no-any
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
    if (ex) {
        customProperties.stackTrace = getStackTrace(ex);
    }
    if (ex && (eventName as any) !== 'ERROR') {
        customProperties.originalEventName = eventName as any as string;
        reporter.sendTelemetryEvent('ERROR', customProperties, measures);
    }
    reporter.sendTelemetryEvent((eventName as any) as string, customProperties, measures);

    // Enable this to debug telemetry. To be discussed whether or not we want this all of the time.
    // try {
    //     traceInfo(`Telemetry: ${eventName} : ${JSON.stringify(customProperties)}`);
    // } catch {
    //     noop();
    // }
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
    return trace.trim();
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
    [EventName.DEBUGGER]: DebuggerTelemetry;
    [EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS]: never | undefined;
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS]: DebuggerConfigurationPromtpsTelemetry;
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS_IN_LAUNCH_JSON]: never | undefined;
    [EventName.DEFINITION]: never | undefined;
    [EventName.DIAGNOSTICS_ACTION]: DiagnosticsAction;
    [EventName.DIAGNOSTICS_MESSAGE]: DiagnosticsMessages;
    [EventName.EDITOR_LOAD]: EditorLoadTelemetry;
    [EventName.ENVFILE_VARIABLE_SUBSTITUTION]: never | undefined;
    [EventName.EXECUTION_CODE]: CodeExecutionTelemetry;
    [EventName.EXECUTION_DJANGO]: CodeExecutionTelemetry;
    [EventName.FORMAT]: FormatTelemetry;
    [EventName.FORMAT_ON_TYPE]: { enabled: boolean };
    [EventName.FORMAT_SORT_IMPORTS]: never | undefined;
    [EventName.GO_TO_OBJECT_DEFINITION]: never | undefined;
    [EventName.HOVER_DEFINITION]: never | undefined;
    [EventName.HASHED_PACKAGE_NAME]: { hashedName: string };
    [EventName.LINTER_NOT_INSTALLED_PROMPT]: LinterInstallPromptTelemetry;
    [EventName.PYTHON_INSTALL_PACKAGE]: { installer: string };
    [EventName.LINTING]: LintingTelemetry;
    [EventName.PLATFORM_INFO]: Platform;
    [EventName.PYTHON_INTERPRETER]: PythonInterpreterTelemetry;
    [EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES]: InterpreterActivationEnvironmentVariables;
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_RUNNING_CODE]: InterpreterActivation;
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_TERMINAL]: InterpreterActivation;
    [EventName.PYTHON_INTERPRETER_AUTO_SELECTION]: InterpreterAutoSelection;
    [EventName.PYTHON_INTERPRETER_DISCOVERY]: InterpreterDiscovery;
    [EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT]: { selection: 'Yes' | 'No' | 'Ignore' | undefined };
    [EventName.PYTHON_LANGUAGE_SERVER_SWITCHED]: { change: 'Switch to Jedi from LS' | 'Switch to LS from Jedi' };
    [EventName.PYTHON_LANGUAGE_SERVER_ANALYSISTIME]: { success: boolean };
    [EventName.PYTHON_LANGUAGE_SERVER_DOWNLOADED]: LanguageServerVersionTelemetry;
    [EventName.PYTHON_LANGUAGE_SERVER_ENABLED]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_ERROR]: LanguageServerErrorTelemetry;
    [EventName.PYTHON_LANGUAGE_SERVER_EXTRACTED]: LanguageServerVersionTelemetry;
    [EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_NOT_SUPPORTED]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED]: LanguageServePlatformSupported;
    [EventName.PYTHON_LANGUAGE_SERVER_READY]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_STARTUP]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_TELEMETRY]: any;
    [EventName.REFACTOR_EXTRACT_FUNCTION]: never | undefined;
    [EventName.REFACTOR_EXTRACT_VAR]: never | undefined;
    [EventName.REFACTOR_RENAME]: never | undefined;
    [EventName.REFERENCE]: never | undefined;
    [EventName.REPL]: never | undefined;
    [EventName.SELECT_LINTER]: LinterSelectionTelemetry;
    [EventName.CONFIGURE_AVAILABLE_LINTER_PROMPT]: { tool: LinterId; action: 'enable' | 'ignore' | 'disablePrompt' | undefined };
    [EventName.SIGNATURE]: never | undefined;
    [EventName.SYMBOL]: never | undefined;
    [EventName.UNITTEST_CONFIGURE]: never | undefined;
    [EventName.UNITTEST_CONFIGURING]: TestConfiguringTelemetry;
    [EventName.TERMINAL_CREATE]: TerminalTelemetry;
    [EventName.UNITTEST_DISCOVER]: TestDiscoverytTelemetry;
    [EventName.UNITTEST_DISCOVER_WITH_PYCODE]: never | undefined;
    [EventName.UNITTEST_RUN]: TestRunTelemetry;
    [EventName.UNITTEST_STOP]: never | undefined;
    [EventName.UNITTEST_DISABLE]: never | undefined;
    [EventName.UNITTEST_VIEW_OUTPUT]: never | undefined;
    [EventName.UPDATE_PYSPARK_LIBRARY]: never | undefined;
    [EventName.WORKSPACE_SYMBOLS_BUILD]: never | undefined;
    [EventName.WORKSPACE_SYMBOLS_GO_TO]: never | undefined;
    // Data Science
    [Telemetry.CollapseAll]: never | undefined;
    [Telemetry.ConnectFailedJupyter]: never | undefined;
    [Telemetry.ConnectLocalJupyter]: never | undefined;
    [Telemetry.ConnectRemoteJupyter]: never | undefined;
    [Telemetry.ConnectRemoteFailedJupyter]: never | undefined;
    [Telemetry.DataScienceSettings]: JSONObject;
    [Telemetry.DeleteAllCells]: never | undefined;
    [Telemetry.DeleteCell]: never | undefined;
    [Telemetry.DisableInteractiveShiftEnter]: never | undefined;
    [Telemetry.EnableInteractiveShiftEnter]: never | undefined;
    [Telemetry.ExpandAll]: never | undefined;
    [Telemetry.ExportNotebook]: never | undefined;
    [Telemetry.ExportPythonFile]: never | undefined;
    [Telemetry.ExportPythonFileAndOutput]: never | undefined;
    [Telemetry.GotoSourceCode]: never | undefined;
    [Telemetry.ImportNotebook]: { scope: 'command' | 'file' };
    [Telemetry.Interrupt]: never | undefined;
    [Telemetry.PandasNotInstalled]: never | undefined;
    [Telemetry.PandasTooOld]: never | undefined;
    [Telemetry.Redo]: never | undefined;
    [Telemetry.RemoteAddCode]: never | undefined;
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
    [Telemetry.SelectJupyterURI]: never | undefined;
    [Telemetry.SetJupyterURIToLocal]: never | undefined;
    [Telemetry.SetJupyterURIToUserSpecified]: never | undefined;
    [Telemetry.ShiftEnterBannerShown]: never | undefined;
    [Telemetry.ShowDataViewer]: { rows: number | undefined };
    [Telemetry.ShowHistoryPane]: never | undefined;
    [Telemetry.StartJupyter]: never | undefined;
    [Telemetry.SubmitCellThroughInput]: never | undefined;
    [Telemetry.Undo]: never | undefined;
    [Telemetry.VariableExplorerToggled]: { open: boolean };
    [Telemetry.VariableExplorerVariableCount]: { variableCount: number };
    [EventName.UNITTEST_NAVIGATE_TEST_FILE]: never | undefined;
    [EventName.UNITTEST_NAVIGATE_TEST_FUNCTION]: { focus_code: boolean };
    [EventName.UNITTEST_NAVIGATE_TEST_SUITE]: { focus_code: boolean };
    [EventName.UNITTEST_EXPLORER_WORK_SPACE_COUNT]: { count: number };
}
