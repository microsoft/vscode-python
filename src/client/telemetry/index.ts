// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { JSONObject } from '@phosphor/coreutils';
// tslint:disable-next-line: import-name
import TelemetryReporter from 'vscode-extension-telemetry/lib/telemetryReporter';

import { LanguageServerType } from '../activation/types';
import { DiagnosticCodes } from '../application/diagnostics/constants';
import { IWorkspaceService } from '../common/application/types';
import { AppinsightsKey, isTestExecution, isUnitTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import { traceError, traceInfo } from '../common/logger';
import { TerminalShellType } from '../common/terminal/types';
import { Architecture } from '../common/utils/platform';
import { StopWatch } from '../common/utils/stopWatch';
import {
    JupyterCommands,
    NativeKeyboardCommandTelemetry,
    NativeMouseCommandTelemetry,
    Telemetry,
    VSCodeNativeTelemetry
} from '../datascience/constants';
import { ExportFormat } from '../datascience/export/types';
import { DebugConfigurationType } from '../debugger/extension/types';
import { ConsoleType, TriggerType } from '../debugger/types';
import { AutoSelectionRule } from '../interpreter/autoSelection/types';
import { LinterId } from '../linters/types';
import { EnvironmentType } from '../pythonEnvironments/info';
import { TestProvider } from '../testing/common/types';
import { EventName, PlatformErrors } from './constants';
import { LinterTrigger, TestTool } from './types';

// tslint:disable: no-any

/**
 * Checks whether telemetry is supported.
 * Its possible this function gets called within Debug Adapter, vscode isn't available in there.
 * Within DA, there's a completely different way to send telemetry.
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

const sharedProperties: Record<string, any> = {};
/**
 * Set shared properties for all telemetry events.
 */
export function setSharedProperty<P extends ISharedPropertyMapping, E extends keyof P>(name: E, value?: P[E]): void {
    const propertyName = name as string;
    // Ignore such shared telemetry during unit tests.
    if (isUnitTestExecution() && propertyName.startsWith('ds_')) {
        return;
    }
    if (value === undefined) {
        delete sharedProperties[propertyName];
    } else {
        sharedProperties[propertyName] = value;
    }
}

/**
 * Reset shared properties for testing purposes.
 */
export function _resetSharedProperties(): void {
    for (const key of Object.keys(sharedProperties)) {
        delete sharedProperties[key];
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
    const extension = extensions.getExtension(extensionId)!;
    const extensionVersion = extension.packageJSON.version;

    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    return (telemetryReporter = new reporter(extensionId, extensionVersion, AppinsightsKey, true));
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
    let customProperties: Record<string, string> = {};
    const eventNameSent = eventName as string;

    if (ex) {
        // When sending telemetry events for exceptions no need to send custom properties.
        // Else we have to review all properties every time as part of GDPR.
        // Assume we have 10 events all with their own properties.
        // As we have errors for each event, those properties are treated as new data items.
        // Hence they need to be classified as part of the GDPR process, and thats unnecessary and onerous.
        customProperties = { originalEventName: eventName as string };
        reporter.sendTelemetryException(ex, customProperties, measures);
    } else {
        if (properties) {
            const data = properties as any;
            Object.getOwnPropertyNames(data).forEach((prop) => {
                if (data[prop] === undefined || data[prop] === null) {
                    return;
                }
                try {
                    // If there are any errors in serializing one property, ignore that and move on.
                    // Else nothing will be sent.
                    customProperties[prop] =
                        typeof data[prop] === 'string'
                            ? data[prop]
                            : typeof data[prop] === 'object'
                            ? 'object'
                            : data[prop].toString();
                } catch (ex) {
                    traceError(`Failed to serialize ${prop} for ${eventName}`, ex);
                }
            });
        }

        // Add shared properties to telemetry props (we may overwrite existing ones).
        Object.assign(customProperties, sharedProperties);

        // Remove shared DS properties from core extension telemetry.
        Object.keys(sharedProperties).forEach((shareProperty) => {
            if (
                customProperties[shareProperty] &&
                shareProperty.startsWith('ds_') &&
                !(eventNameSent.startsWith('DS_') || eventNameSent.startsWith('DATASCIENCE'))
            ) {
                delete customProperties[shareProperty];
            }
        });

        reporter.sendTelemetryEvent(eventNameSent, customProperties, measures);
    }

    if (process.env && process.env.VSC_PYTHON_LOG_TELEMETRY) {
        traceInfo(
            `Telemetry Event : ${eventNameSent} Measures: ${JSON.stringify(measures)} Props: ${JSON.stringify(
                customProperties
            )} `
        );
    }
}

// Type-parameterized form of MethodDecorator in lib.es5.d.ts.
type TypedMethodDescriptor<T> = (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;

/**
 * Decorates a method, sending a telemetry event with the given properties.
 * @param eventName The event name to send.
 * @param properties Properties to send with the event; must be valid for the event.
 * @param captureDuration True if the method's execution duration should be captured.
 * @param failureEventName If the decorated method returns a Promise and fails, send this event instead of eventName.
 * @param lazyProperties A static function on the decorated class which returns extra properties to add to the event.
 * This can be used to provide properties which are only known at runtime (after the decorator has executed).
 */
// tslint:disable-next-line:no-any function-name
export function captureTelemetry<This, P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    properties?: P[E],
    captureDuration: boolean = true,
    failureEventName?: E,
    lazyProperties?: (obj: This) => P[E]
): TypedMethodDescriptor<(this: This, ...args: any[]) => any> {
    // tslint:disable-next-line:no-function-expression no-any
    return function (
        _target: Object,
        _propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<(this: This, ...args: any[]) => any>
    ) {
        const originalMethod = descriptor.value!;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (this: This, ...args: any[]) {
            // Legacy case; fast path that sends event before method executes.
            // Does not set "failed" if the result is a Promise and throws an exception.
            if (!captureDuration && !lazyProperties) {
                sendTelemetryEvent(eventName, undefined, properties);
                // tslint:disable-next-line:no-invalid-this
                return originalMethod.apply(this, args);
            }

            const props = () => {
                if (lazyProperties) {
                    return { ...properties, ...lazyProperties(this) };
                }
                return properties;
            };

            const stopWatch = captureDuration ? new StopWatch() : undefined;

            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then((data) => {
                        sendTelemetryEvent(eventName, stopWatch?.elapsedTime, props());
                        return data;
                    })
                    // tslint:disable-next-line:promise-function-async
                    .catch((ex) => {
                        // tslint:disable-next-line:no-any
                        const failedProps: P[E] = props() || ({} as any);
                        (failedProps as any).failed = true;
                        sendTelemetryEvent(
                            failureEventName ? failureEventName : eventName,
                            stopWatch?.elapsedTime,
                            failedProps,
                            ex
                        );
                    });
            } else {
                sendTelemetryEvent(eventName, stopWatch?.elapsedTime, props());
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
            (data) => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return data;
                // tslint:disable-next-line:promise-function-async
            },
            (ex) => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties, ex);
                return Promise.reject(ex);
            }
        );
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}

/**
 * Map all shared properties to their data types.
 */
export interface ISharedPropertyMapping {
    /**
     * For every DS telemetry we would like to know the type of Notebook Editor used when doing something.
     */
    ['ds_notebookeditor']: undefined | 'old' | 'custom' | 'native';

    /**
     * For every telemetry event from the extension we want to make sure we can associate it with install
     * source. We took this approach to work around very limiting query performance issues.
     */
    ['installSource']: undefined | 'marketPlace' | 'pythonCodingPack';
}

// Map all events to their properties
export interface IEventNamePropertyMapping {
    /**
     * Telemetry event sent when providing completion items for the given position and document.
     */
    [EventName.COMPLETION]: never | undefined;
    /**
     * Telemetry event sent with details 'python.autoComplete.addBrackets' setting
     */
    [EventName.COMPLETION_ADD_BRACKETS]: {
        /**
         * Carries boolean `true` if 'python.autoComplete.addBrackets' is set to true, `false` otherwise
         */
        enabled: boolean;
    };
    /**
     * Telemetry event captured when debug adapter executable is created
     */
    [EventName.DEBUG_ADAPTER_USING_WHEELS_PATH]: {
        /**
         * Carries boolean
         * - `true` if path used for the adapter is the debugger with wheels.
         * - `false` if path used for the adapter is the source only version of the debugger.
         */
        usingWheels: boolean;
    };
    /**
     * Telemetry captured before starting debug session.
     */
    [EventName.DEBUG_SESSION_START]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {TriggerType}
         */
        trigger: TriggerType;
        /**
         * Type of console used.
         *  -`internalConsole`: Use VS Code debug console (no shells/terminals).
         * - `integratedTerminal`: Use VS Code terminal.
         * - `externalTerminal`: Use an External terminal.
         *
         * @type {ConsoleType}
         */
        console?: ConsoleType;
    };
    /**
     * Telemetry captured when debug session runs into an error.
     */
    [EventName.DEBUG_SESSION_ERROR]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {TriggerType}
         */
        trigger: TriggerType;
        /**
         * Type of console used.
         *  -`internalConsole`: Use VS Code debug console (no shells/terminals).
         * - `integratedTerminal`: Use VS Code terminal.
         * - `externalTerminal`: Use an External terminal.
         *
         * @type {ConsoleType}
         */
        console?: ConsoleType;
    };
    /**
     * Telemetry captured after stopping debug session.
     */
    [EventName.DEBUG_SESSION_STOP]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {TriggerType}
         */
        trigger: TriggerType;
        /**
         * Type of console used.
         *  -`internalConsole`: Use VS Code debug console (no shells/terminals).
         * - `integratedTerminal`: Use VS Code terminal.
         * - `externalTerminal`: Use an External terminal.
         *
         * @type {ConsoleType}
         */
        console?: ConsoleType;
    };
    /**
     * Telemetry captured when user code starts running after loading the debugger.
     */
    [EventName.DEBUG_SESSION_USER_CODE_RUNNING]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {TriggerType}
         */
        trigger: TriggerType;
        /**
         * Type of console used.
         *  -`internalConsole`: Use VS Code debug console (no shells/terminals).
         * - `integratedTerminal`: Use VS Code terminal.
         * - `externalTerminal`: Use an External terminal.
         *
         * @type {ConsoleType}
         */
        console?: ConsoleType;
    };
    /**
     * Telemetry captured when starting the debugger.
     */
    [EventName.DEBUGGER]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {TriggerType}
         */
        trigger: TriggerType;
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
         * Whether using `gevent` when debugging.
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
    /**
     * Telemetry event sent when attaching to child process
     */
    [EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS]: never | undefined;
    /**
     * Telemetry event sent when attaching to a local process.
     */
    [EventName.DEBUGGER_ATTACH_TO_LOCAL_PROCESS]: never | undefined;
    /**
     * Telemetry sent after building configuration for debugger
     */
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS]: {
        /**
         * The type of debug configuration to build configuration for
         *
         * @type {DebugConfigurationType}
         */
        configurationType: DebugConfigurationType;
        /**
         * Carries `true` if we are able to auto-detect manage.py path for Django, `false` otherwise
         *
         * @type {boolean}
         */
        autoDetectedDjangoManagePyPath?: boolean;
        /**
         * Carries `true` if we are able to auto-detect .ini file path for Pyramid, `false` otherwise
         *
         * @type {boolean}
         */
        autoDetectedPyramidIniPath?: boolean;
        /**
         * Carries `true` if we are able to auto-detect app.py path for Flask, `false` otherwise
         *
         * @type {boolean}
         */
        autoDetectedFlaskAppPyPath?: boolean;
        /**
         * Carries `true` if user manually entered the required path for the app
         * (path to `manage.py` for Django, path to `.ini` for Pyramid, path to `app.py` for Flask), `false` otherwise
         *
         * @type {boolean}
         */
        manuallyEnteredAValue?: boolean;
    };
    [EventName.OPEN_DATAVIEWER_FROM_VARIABLE_WINDOW_REQUEST]: never | undefined;
    [EventName.OPEN_DATAVIEWER_FROM_VARIABLE_WINDOW_ERROR]: never | undefined;
    [EventName.OPEN_DATAVIEWER_FROM_VARIABLE_WINDOW_SUCCESS]: never | undefined;
    /**
     * Telemetry event sent when providing completion provider in launch.json. It is sent just *after* inserting the completion.
     */
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS_IN_LAUNCH_JSON]: never | undefined;
    /**
     * Telemetry is sent when providing definitions for python code, particularly when [go to definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition)
     * and peek definition features are used.
     */
    [EventName.DEFINITION]: never | undefined;
    /**
     * Telemetry event sent with details of actions when invoking a diagnostic command
     */
    [EventName.DIAGNOSTICS_ACTION]: {
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
    /**
     * Telemetry event sent when we are checking if we can handle the diagnostic code
     */
    [EventName.DIAGNOSTICS_MESSAGE]: {
        /**
         * Code of diagnostics message detected and displayed.
         * @type {string}
         */
        code: DiagnosticCodes;
    };
    /**
     * Telemetry event sent with details just after editor loads
     */
    [EventName.EDITOR_LOAD]: {
        /**
         * The conda version if selected
         */
        condaVersion: string | undefined;
        /**
         * The python interpreter version if selected
         */
        pythonVersion: string | undefined;
        /**
         * The type of interpreter (conda, virtualenv, pipenv etc.)
         */
        interpreterType: EnvironmentType | undefined;
        /**
         * The type of terminal shell created: powershell, cmd, zsh, bash etc.
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
        /**
         * Number of workspace folders opened
         */
        workspaceFolderCount: number;
        /**
         * If interpreters found for the main workspace contains a python3 interpreter
         */
        hasPython3: boolean;
        /**
         * If user has defined an interpreter in settings.json
         */
        usingUserDefinedInterpreter: boolean;
        /**
         * If interpreter is auto selected for the workspace
         */
        usingAutoSelectedWorkspaceInterpreter: boolean;
        /**
         * If global interpreter is being used
         */
        usingGlobalInterpreter: boolean;
    };
    /**
     * Telemetry event sent when substituting Environment variables to calculate value of variables
     */
    [EventName.ENVFILE_VARIABLE_SUBSTITUTION]: never | undefined;
    /**
     * Telemetry event sent when an environment file is detected in the workspace.
     */
    [EventName.ENVFILE_WORKSPACE]: {
        /**
         * If there's a custom path specified in the python.envFile workspace settings.
         */
        hasCustomEnvPath: boolean;
    };
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
    /**
     * Telemetry event sent with details when formatting a document
     */
    [EventName.FORMAT]: {
        /**
         * Tool being used to format
         */
        tool: 'autopep8' | 'black' | 'yapf';
        /**
         * If arguments for formatter is provided in resource settings
         */
        hasCustomArgs: boolean;
        /**
         * Carries `true` when formatting a selection of text, `false` otherwise
         */
        formatSelection: boolean;
    };
    /**
     * Telemetry event sent with the value of setting 'Format on type'
     */
    [EventName.FORMAT_ON_TYPE]: {
        /**
         * Carries `true` if format on type is enabled, `false` otherwise
         *
         * @type {boolean}
         */
        enabled: boolean;
    };
    /**
     * Telemetry event sent when sorting imports using formatter
     */
    [EventName.FORMAT_SORT_IMPORTS]: never | undefined;
    /**
     * Telemetry event sent when Go to Python object command is executed
     */
    [EventName.GO_TO_OBJECT_DEFINITION]: never | undefined;
    /**
     * Telemetry event sent when providing a hover for the given position and document for interactive window using Jedi.
     */
    [EventName.HOVER_DEFINITION]: never | undefined;
    /**
     * Telemetry event sent with details when tracking imports
     */
    [EventName.HASHED_PACKAGE_NAME]: {
        /**
         * Hash of the package name
         *
         * @type {string}
         */
        hashedName: string;
    };
    [Telemetry.HashedCellOutputMimeTypePerf]: never | undefined;
    [Telemetry.HashedNotebookCellOutputMimeTypePerf]: never | undefined;
    [Telemetry.HashedCellOutputMimeType]: {
        /**
         * Hash of the cell output mimetype
         *
         * @type {string}
         */
        hashedName: string;
        hasText: boolean;
        hasLatex: boolean;
        hasHtml: boolean;
        hasSvg: boolean;
        hasXml: boolean;
        hasJson: boolean;
        hasImage: boolean;
        hasGeo: boolean;
        hasPlotly: boolean;
        hasVega: boolean;
        hasWidget: boolean;
        hasJupyter: boolean;
        hasVnd: boolean;
    };
    [EventName.HASHED_PACKAGE_PERF]: never | undefined;
    /**
     * Telemetry event sent with details of selection in prompt
     * `Prompt message` :- 'Linter ${productName} is not installed'
     */
    [EventName.LINTER_NOT_INSTALLED_PROMPT]: {
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
    /**
     * Telemetry event sent when installing modules
     */
    [EventName.PYTHON_INSTALL_PACKAGE]: {
        /**
         * The name of the module. (pipenv, Conda etc.)
         *
         * @type {string}
         */
        installer: string;
    };
    /**
     * Telemetry sent with details immediately after linting a document completes
     */
    [EventName.LINTING]: {
        /**
         * Name of the linter being used
         *
         * @type {LinterId}
         */
        tool: LinterId;
        /**
         * If custom arguments for linter is provided in settings.json
         *
         * @type {boolean}
         */
        hasCustomArgs: boolean;
        /**
         * Carries the source which triggered configuration of tests
         *
         * @type {LinterTrigger}
         */
        trigger: LinterTrigger;
        /**
         * Carries `true` if linter executable is specified, `false` otherwise
         *
         * @type {boolean}
         */
        executableSpecified: boolean;
    };
    /**
     * Telemetry event sent after fetching the OS version
     */
    [EventName.PLATFORM_INFO]: {
        /**
         * If fetching OS version fails, list the failure type
         *
         * @type {PlatformErrors}
         */
        failureType?: PlatformErrors;
        /**
         * The OS version of the platform
         *
         * @type {string}
         */
        osVersion?: string;
    };
    /**
     * Telemetry is sent with details about the play run file icon
     */
    [EventName.PLAY_BUTTON_ICON_DISABLED]: {
        /**
         * Carries `true` if play button icon is not shown (because code runner is installed), `false` otherwise
         */
        disabled: boolean;
    };
    /**
     * Telemetry event sent when 'Select Interpreter' command is invoked.
     */
    [EventName.SELECT_INTERPRETER]: never | undefined;
    /**
     * Telemetry event sent when 'Enter interpreter path' button is clicked.
     */
    [EventName.SELECT_INTERPRETER_ENTER_BUTTON]: never | undefined;
    /**
     * Telemetry event sent with details about what choice user made to input the interpreter path.
     */
    [EventName.SELECT_INTERPRETER_ENTER_CHOICE]: {
        /**
         * Carries 'enter' if user chose to enter the path to executable.
         * Carries 'browse' if user chose to browse for the path to the executable.
         */
        choice: 'enter' | 'browse';
    };
    /**
     * Telemetry event sent with details after updating the python interpreter
     */
    [EventName.PYTHON_INTERPRETER]: {
        /**
         * Carries the source which triggered the update
         *
         * @type {('ui' | 'shebang' | 'load')}
         */
        trigger: 'ui' | 'shebang' | 'load';
        /**
         * Carries `true` if updating python interpreter failed
         *
         * @type {boolean}
         */
        failed: boolean;
        /**
         * The python version of the interpreter
         *
         * @type {string}
         */
        pythonVersion?: string;
        /**
         * The version of pip module installed in the python interpreter
         *
         * @type {string}
         */
        pipVersion?: string;
        /**
         * The bit-ness of the python interpreter represented using architecture.
         *
         * @type {Architecture}
         */
        architecture?: Architecture;
    };
    [EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES]: {
        /**
         * Carries `true` if environment variables are present, `false` otherwise
         *
         * @type {boolean}
         */
        hasEnvVars?: boolean;
        /**
         * Carries `true` if fetching environment variables failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed?: boolean;
        /**
         * Whether the environment was activated within a terminal or not.
         *
         * @type {boolean}
         */
        activatedInTerminal?: boolean;
        /**
         * Whether the environment was activated by the wrapper class.
         * If `true`, this telemetry is sent by the class that wraps the two activation providers   .
         *
         * @type {boolean}
         */
        activatedByWrapper?: boolean;
    };
    /**
     * Telemetry event sent when getting activation commands for active interpreter
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_RUNNING_CODE]: {
        /**
         * Carries `true` if activation commands exists for interpreter, `false` otherwise
         *
         * @type {boolean}
         */
        hasCommands?: boolean;
        /**
         * Carries `true` if fetching activation commands for interpreter failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed?: boolean;
        /**
         * The type of terminal shell to activate
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
        /**
         * The Python interpreter version of the active interpreter for the resource
         *
         * @type {string}
         */
        pythonVersion?: string;
        /**
         * The type of the interpreter used
         *
         * @type {EnvironmentType}
         */
        interpreterType: EnvironmentType;
    };
    /**
     * Telemetry event sent when getting activation commands for terminal when interpreter is not specified
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_TERMINAL]: {
        /**
         * Carries `true` if activation commands exists for terminal, `false` otherwise
         *
         * @type {boolean}
         */
        hasCommands?: boolean;
        /**
         * Carries `true` if fetching activation commands for terminal failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed?: boolean;
        /**
         * The type of terminal shell to activate
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
        /**
         * The Python interpreter version of the interpreter for the resource
         *
         * @type {string}
         */
        pythonVersion?: string;
        /**
         * The type of the interpreter used
         *
         * @type {EnvironmentType}
         */
        interpreterType: EnvironmentType;
    };
    [EventName.PYTHON_INTERPRETER_AUTO_SELECTION]: {
        /**
         * The rule used to auto-select the interpreter
         *
         * @type {AutoSelectionRule}
         */
        rule?: AutoSelectionRule;
        /**
         * If cached interpreter no longer exists or is invalid
         *
         * @type {boolean}
         */
        interpreterMissing?: boolean;
        /**
         * Carries `true` if next rule is identified for autoselecting interpreter
         *
         * @type {boolean}
         */
        identified?: boolean;
        /**
         * Carries `true` if cached interpreter is updated to use the current interpreter, `false` otherwise
         *
         * @type {boolean}
         */
        updated?: boolean;
    };
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
    /**
     * Telemetry event sent when pipenv interpreter discovery is executed.
     */
    [EventName.PIPENV_INTERPRETER_DISCOVERY]: never | undefined;
    /**
     * Telemetry event sent with details when user clicks the prompt with the following message
     * `Prompt message` :- 'We noticed you're using a conda environment. If you are experiencing issues with this environment in the integrated terminal, we suggest the "terminal.integrated.inheritEnv" setting to be changed to false. Would you like to update this setting?'
     */
    [EventName.CONDA_INHERIT_ENV_PROMPT]: {
        /**
         * `Yes` When 'Yes' option is selected
         * `No` When 'No' option is selected
         * `More info` When 'More Info' option is selected
         */
        selection: 'Yes' | 'No' | 'More Info' | undefined;
    };
    /**
     * Telemetry event sent with details when user clicks the prompt with the following message
     * `Prompt message` :- 'We found a Python environment in this workspace. Do you want to select it to start up the features in the Python extension? Only accept if you trust this environment.'
     */
    [EventName.UNSAFE_INTERPRETER_PROMPT]: {
        /**
         * `Yes` When 'Yes' option is selected
         * `No` When 'No' option is selected
         * `Learn more` When 'More Info' option is selected
         * `Do not show again` When 'Do not show again' option is selected
         */
        selection: 'Yes' | 'No' | 'Learn more' | 'Do not show again' | undefined;
    };
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
    /**
     * Telemetry event sent with details when the user clicks a button in the "Python is not installed" prompt.
     * * `Prompt message` :- 'Python is not installed. Please download and install Python before using the extension.'
     */
    [EventName.PYTHON_NOT_INSTALLED_PROMPT]: {
        /**
         * `Download` When the 'Download' option is clicked
         * `Ignore` When the prompt is dismissed
         *
         * @type {('Download' | 'Ignore' | undefined)}
         */
        selection: 'Download' | 'Ignore' | undefined;
    };

    /**
     * Telemetry event sent with details when user clicks a button in the following prompt
     * `Prompt message` :- 'We noticed you are using Visual Studio Code Insiders. Would you like to use the Insiders build of the Python extension?'
     */
    [EventName.INSIDERS_PROMPT]: {
        /**
         * `Yes, weekly` When user selects to use "weekly" as extension channel in insiders prompt
         * `Yes, daily` When user selects to use "daily" as extension channel in insiders prompt
         * `No, thanks` When user decides to keep using the same extension channel as before
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
     * Telemetry sent with details about the current selection of language server
     */
    [EventName.PYTHON_LANGUAGE_SERVER_CURRENT_SELECTION]: {
        /**
         * The startup value of the language server setting
         */
        lsStartup?: LanguageServerType;
        /**
         * Used to track switch between language servers. Carries the final state after the switch.
         */
        switchTo?: LanguageServerType;
    };
    /**
     * Telemetry event sent with details after attempting to download LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_DOWNLOADED]: {
        /**
         * Whether LS downloading succeeds
         */
        success: boolean;
        /**
         * Version of LS downloaded
         */
        lsVersion?: string;
        /**
         * Whether download uri starts with `https:` or not
         */
        usedSSL?: boolean;

        /**
         * Name of LS downloaded
         */
        lsName?: string;
    };
    /**
     * Telemetry event sent when LS is started for workspace (workspace folder in case of multi-root)
     */
    [EventName.PYTHON_LANGUAGE_SERVER_ENABLED]: {
        lsVersion?: string;
    };
    /**
     * Telemetry event sent with details when downloading or extracting LS fails
     */
    [EventName.PYTHON_LANGUAGE_SERVER_ERROR]: {
        /**
         * The error associated with initializing language server
         */
        error: string;
    };
    /**
     * Telemetry event sent with details after attempting to extract LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_EXTRACTED]: {
        /**
         * Whether LS extracting succeeds
         */
        success: boolean;
        /**
         * Version of LS extracted
         */
        lsVersion?: string;
        /**
         * Whether download uri starts with `https:` or not
         */
        usedSSL?: boolean;
        /**
         * Package name of LS extracted
         */
        lsName?: string;
    };
    /**
     * Telemetry event sent if azure blob packages are being listed
     */
    [EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES]: never | undefined;
    /**
     * Tracks if LS is supported on platform or not
     */
    [EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED]: {
        /**
         * Carries `true` if LS is supported, `false` otherwise
         *
         * @type {boolean}
         */
        supported: boolean;
        /**
         * If checking support for LS failed
         *
         * @type {'UnknownError'}
         */
        failureType?: 'UnknownError';
    };
    /**
     * Telemetry event sent when LS is ready to start
     */
    [EventName.PYTHON_LANGUAGE_SERVER_READY]: {
        lsVersion?: string;
    };
    /**
     * Telemetry event sent when starting LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_STARTUP]: {
        lsVersion?: string;
    };
    /**
     * Telemetry sent from language server (details of telemetry sent can be provided by LS team)
     */
    [EventName.PYTHON_LANGUAGE_SERVER_TELEMETRY]: any;
    /**
     * Telemetry sent when the client makes a request to the language server
     */
    [EventName.PYTHON_LANGUAGE_SERVER_REQUEST]: any;
    /**
     * Telemetry event sent with details when inExperiment() API is called
     */
    [EventName.PYTHON_EXPERIMENTS]: {
        /**
         * Name of the experiment group the user is in
         * @type {string}
         */
        expName?: string;
    };
    /**
     * Telemetry event sent when Experiments have been disabled.
     */
    [EventName.PYTHON_EXPERIMENTS_DISABLED]: never | undefined;
    /**
     * Telemetry event sent with details when a user has requested to opt it or out of an experiment group
     */
    [EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT]: {
        /**
         * Carries the name of the experiment user has been opted into manually
         */
        expNameOptedInto?: string;
        /**
         * Carries the name of the experiment user has been opted out of manually
         */
        expNameOptedOutOf?: string;
    };
    /**
     * Telemetry event sent with details when doing best effort to download the experiments within timeout and using it in the current session only
     */
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
     * Telemetry event sent when LS is started for workspace (workspace folder in case of multi-root)
     */
    [EventName.LANGUAGE_SERVER_ENABLED]: {
        lsVersion?: string;
    };
    /**
     * Telemetry event sent when Node.js server is ready to start
     */
    [EventName.LANGUAGE_SERVER_READY]: {
        lsVersion?: string;
    };
    /**
     * Telemetry event sent when starting Node.js server
     */
    [EventName.LANGUAGE_SERVER_STARTUP]: {
        lsVersion?: string;
    };
    /**
     * Telemetry sent from Node.js server (details of telemetry sent can be provided by LS team)
     */
    [EventName.LANGUAGE_SERVER_TELEMETRY]: any;
    /**
     * Telemetry sent when the client makes a request to the Node.js server
     */
    [EventName.LANGUAGE_SERVER_REQUEST]: any;
    /**
     * Telemetry sent on user response to 'Try Pylance' prompt.
     */
    [EventName.LANGUAGE_SERVER_TRY_PYLANCE]: {
        /**
         * User response to the prompt.
         * @type {string}
         */
        userAction: string;
    };
    /**
     * Telemetry captured for enabling reload.
     */
    [EventName.PYTHON_WEB_APP_RELOAD]: {
        /**
         * Carries value indicating if the experiment modified `subProcess` field in debug config:
         * - `true` if reload experiment modified the `subProcess` field.
         * - `false` if user provided debug configuration was not changed (already setup for reload)
         */
        subProcessModified?: boolean;
        /**
         * Carries value indicating if the experiment modified `args` field in debug config:
         * - `true` if reload experiment modified the `args` field.
         * - `false` if user provided debug configuration was not changed (already setup for reload)
         */
        argsModified?: boolean;
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
    /**
     * Telemetry event sent when the Python interpreter tip is shown on activation for new users.
     */
    [EventName.ACTIVATION_TIP_PROMPT]: never | undefined;
    /**
     * Telemetry event sent when the feedback survey prompt is shown on activation for new users, and they click on the survey link.
     */
    [EventName.ACTIVATION_SURVEY_PROMPT]: never | undefined;
    /**
     * Telemetry sent back when join mailing list prompt is shown.
     */
    [EventName.JOIN_MAILING_LIST_PROMPT]: {
        /**
         * Carries the selection of user when they are asked to join the mailing list.
         */
        selection: 'Yes' | 'No' | undefined;
    };
    /**
     * Telemetry event sent when 'Extract Method' command is invoked
     */
    [EventName.REFACTOR_EXTRACT_FUNCTION]: never | undefined;
    /**
     * Telemetry event sent when 'Extract Variable' command is invoked
     */
    [EventName.REFACTOR_EXTRACT_VAR]: never | undefined;
    /**
     * Telemetry event sent when providing an edit that describes changes to rename a symbol to a different name
     */
    [EventName.REFACTOR_RENAME]: never | undefined;
    /**
     * Telemetry event sent when providing a set of project-wide references for the given position and document
     */
    [EventName.REFERENCE]: never | undefined;
    /**
     * Telemetry event sent when starting REPL
     */
    [EventName.REPL]: never | undefined;
    /**
     * Telemetry event sent with details of linter selected in quickpick of linter list.
     */
    [EventName.SELECT_LINTER]: {
        /**
         * The name of the linter
         */
        tool?: LinterId;
        /**
         * Carries `true` if linter is enabled, `false` otherwise
         */
        enabled: boolean;
    };
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
    /**
     * Telemetry event sent when providing help for the signature at the given position and document.
     */
    [EventName.SIGNATURE]: never | undefined;
    /**
     * Telemetry event sent when providing document symbol information for Jedi autocomplete intellisense
     */
    [EventName.SYMBOL]: never | undefined;
    /**
     * Telemetry event sent if and when user configure tests command. This command can be trigerred from multiple places in the extension. (Command palette, prompt etc.)
     */
    [EventName.UNITTEST_CONFIGURE]: never | undefined;
    /**
     * Telemetry event sent when user chooses a test framework in the Quickpick displayed for enabling and configuring test framework
     */
    [EventName.UNITTEST_CONFIGURING]: {
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
    /**
     * Telemetry event sent when the extension is activated, if an active terminal is present and
     * the `python.terminal.activateEnvInCurrentTerminal` setting is set to `true`.
     */
    [EventName.ACTIVATE_ENV_IN_CURRENT_TERMINAL]: {
        /**
         * Carries boolean `true` if an active terminal is present (terminal is visible), `false` otherwise
         */
        isTerminalVisible?: boolean;
    };
    /**
     * Telemetry event sent with details when a terminal is created
     */
    [EventName.TERMINAL_CREATE]: {
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
         * @type {EnvironmentType}
         */
        interpreterType?: EnvironmentType;
    };
    /**
     * Telemetry event sent with details about discovering tests
     */
    [EventName.UNITTEST_DISCOVER]: {
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
    /**
     * Telemetry event is sent if we are doing test discovery using python code
     */
    [EventName.UNITTEST_DISCOVER_WITH_PYCODE]: never | undefined;
    /**
     * Telemetry event sent when user clicks a file, function, or suite in test explorer.
     */
    [EventName.UNITTEST_NAVIGATE]: {
        /**
         * Carries `true` if user clicks a file, `false` otherwise
         *
         * @type {boolean}
         */
        byFile?: boolean;
        /**
         * Carries `true` if user clicks a function, `false` otherwise
         *
         * @type {boolean}
         */
        byFunction?: boolean;
        /**
         * Carries `true` if user clicks a suite, `false` otherwise
         *
         * @type {boolean}
         */
        bySuite?: boolean;
        /**
         * Carries `true` if we are changing focus to the suite/file/function, `false` otherwise
         *
         * @type {boolean}
         */
        focus_code?: boolean;
    };
    /**
     * Tracks number of workspace folders shown in test explorer
     */
    [EventName.UNITTEST_EXPLORER_WORK_SPACE_COUNT]: { count: number };
    /**
     * Telemetry event sent with details about running the tests, what is being run, what framework is being used etc.
     */
    [EventName.UNITTEST_RUN]: {
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
    /**
     * Telemetry sent when building workspace symbols
     */
    [EventName.WORKSPACE_SYMBOLS_BUILD]: never | undefined;
    /**
     * Telemetry sent when providing workspace symbols doing Project-wide search for a symbol matching the given query string
     */
    [EventName.WORKSPACE_SYMBOLS_GO_TO]: never | undefined;
    // Data Science
    [Telemetry.AddCellBelow]: never | undefined;
    [Telemetry.CodeLensAverageAcquisitionTime]: never | undefined;
    [Telemetry.CollapseAll]: never | undefined;
    [Telemetry.ConnectFailedJupyter]: never | undefined;
    [Telemetry.ConnectLocalJupyter]: never | undefined;
    [Telemetry.ConnectRemoteJupyter]: never | undefined;
    /**
     * Connecting to an existing Jupyter server, but connecting to localhost.
     */
    [Telemetry.ConnectRemoteJupyterViaLocalHost]: never | undefined;
    [Telemetry.ConnectRemoteFailedJupyter]: never | undefined;
    [Telemetry.ConnectRemoteSelfCertFailedJupyter]: never | undefined;
    [Telemetry.RegisterAndUseInterpreterAsKernel]: never | undefined;
    [Telemetry.UseInterpreterAsKernel]: never | undefined;
    [Telemetry.UseExistingKernel]: never | undefined;
    [Telemetry.SwitchToExistingKernel]: { language: string };
    [Telemetry.SwitchToInterpreterAsKernel]: never | undefined;
    [Telemetry.ConvertToPythonFile]: never | undefined;
    [Telemetry.CopySourceCode]: never | undefined;
    [Telemetry.CreateNewNotebook]: never | undefined;
    [Telemetry.DataScienceSettings]: JSONObject;
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
    /**
     * Telemetry sent to capture first time execution of a cell.
     * If `notebook = true`, this its telemetry for native editor/notebooks.
     */
    [Telemetry.ExecuteCellPerceivedCold]: undefined | { notebook: boolean };
    /**
     * Telemetry sent to capture subsequent execution of a cell.
     * If `notebook = true`, this its telemetry for native editor/notebooks.
     */
    [Telemetry.ExecuteCellPerceivedWarm]: undefined | { notebook: boolean };
    /**
     * Time take for jupyter server to start and be ready to run first user cell.
     */
    [Telemetry.PerceivedJupyterStartupNotebook]: never | undefined;
    /**
     * Time take for jupyter server to be busy from the time user first hit `run` cell until jupyter reports it is busy running a cell.
     */
    [Telemetry.StartExecuteNotebookCellPerceivedCold]: never | undefined;
    [Telemetry.ExecuteNativeCell]: never | undefined;
    [Telemetry.ExpandAll]: never | undefined;
    [Telemetry.ExportNotebookInteractive]: never | undefined;
    [Telemetry.ExportPythonFileInteractive]: never | undefined;
    [Telemetry.ExportPythonFileAndOutputInteractive]: never | undefined;
    [Telemetry.ClickedExportNotebookAsQuickPick]: { format: ExportFormat };
    [Telemetry.ExportNotebookAs]: { format: ExportFormat; cancelled?: boolean; successful?: boolean; opened?: boolean };
    [Telemetry.ExportNotebookAsCommand]: { format: ExportFormat };
    [Telemetry.ExportNotebookAsFailed]: { format: ExportFormat };
    [Telemetry.GetPasswordAttempt]: never | undefined;
    [Telemetry.GetPasswordFailure]: never | undefined;
    [Telemetry.GetPasswordSuccess]: never | undefined;
    [Telemetry.GotoSourceCode]: never | undefined;
    [Telemetry.HiddenCellTime]: never | undefined;
    [Telemetry.ImportNotebook]: { scope: 'command' | 'file' };
    [Telemetry.Interrupt]: never | undefined;
    [Telemetry.InterruptJupyterTime]: never | undefined;
    [Telemetry.NotebookRunCount]: { count: number };
    [Telemetry.NotebookWorkspaceCount]: { count: number };
    [Telemetry.NotebookOpenCount]: { count: number };
    [Telemetry.NotebookOpenTime]: number;
    [Telemetry.PandasNotInstalled]: never | undefined;
    [Telemetry.PandasTooOld]: never | undefined;
    [Telemetry.DebugpyInstallCancelled]: never | undefined;
    [Telemetry.DebugpyInstallFailed]: never | undefined;
    [Telemetry.DebugpyPromptToInstall]: never | undefined;
    [Telemetry.DebugpySuccessfullyInstalled]: never | undefined;
    [Telemetry.OpenNotebook]: { scope: 'command' | 'file' };
    [Telemetry.OpenNotebookAll]: never | undefined;
    [Telemetry.OpenedInteractiveWindow]: never | undefined;
    [Telemetry.OpenPlotViewer]: never | undefined;
    [Telemetry.Redo]: never | undefined;
    [Telemetry.RemoteAddCode]: never | undefined;
    [Telemetry.RemoteReexecuteCode]: never | undefined;
    [Telemetry.RestartJupyterTime]: never | undefined;
    [Telemetry.RestartKernel]: never | undefined;
    [Telemetry.RestartKernelCommand]: never | undefined;
    /**
     * Run Cell Commands in Interactive Python
     */
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
    /**
     * Cell Edit Commands in Interactive Python
     */
    [Telemetry.InsertCellBelowPosition]: never | undefined;
    [Telemetry.InsertCellBelow]: never | undefined;
    [Telemetry.InsertCellAbove]: never | undefined;
    [Telemetry.DeleteCells]: never | undefined;
    [Telemetry.SelectCell]: never | undefined;
    [Telemetry.SelectCellContents]: never | undefined;
    [Telemetry.ExtendSelectionByCellAbove]: never | undefined;
    [Telemetry.ExtendSelectionByCellBelow]: never | undefined;
    [Telemetry.MoveCellsUp]: never | undefined;
    [Telemetry.MoveCellsDown]: never | undefined;
    [Telemetry.ChangeCellToMarkdown]: never | undefined;
    [Telemetry.ChangeCellToCode]: never | undefined;
    [Telemetry.GotoNextCellInFile]: never | undefined;
    [Telemetry.GotoPrevCellInFile]: never | undefined;
    /**
     * Misc
     */
    [Telemetry.AddEmptyCellToBottom]: never | undefined;
    [Telemetry.RunCurrentCellAndAddBelow]: never | undefined;
    [Telemetry.CellCount]: { count: number };
    [Telemetry.Save]: never | undefined;
    [Telemetry.SelfCertsMessageClose]: never | undefined;
    [Telemetry.SelfCertsMessageEnabled]: never | undefined;
    [Telemetry.SelectJupyterURI]: never | undefined;
    [Telemetry.SelectLocalJupyterKernel]: never | undefined;
    [Telemetry.SelectRemoteJupyterKernel]: never | undefined;
    [Telemetry.SessionIdleTimeout]: never | undefined;
    [Telemetry.JupyterNotInstalledErrorShown]: never | undefined;
    [Telemetry.JupyterCommandSearch]: {
        where: 'activeInterpreter' | 'otherInterpreter' | 'path' | 'nowhere';
        command: JupyterCommands;
    };
    [Telemetry.UserInstalledJupyter]: never | undefined;
    [Telemetry.UserInstalledPandas]: never | undefined;
    [Telemetry.UserDidNotInstallJupyter]: never | undefined;
    [Telemetry.UserDidNotInstallPandas]: never | undefined;
    [Telemetry.SetJupyterURIToLocal]: never | undefined;
    [Telemetry.SetJupyterURIToUserSpecified]: never | undefined;
    [Telemetry.ShiftEnterBannerShown]: never | undefined;
    [Telemetry.ShowDataViewer]: { rows: number | undefined; columns: number | undefined };
    [Telemetry.CreateNewInteractive]: never | undefined;
    [Telemetry.StartJupyter]: never | undefined;
    [Telemetry.StartJupyterProcess]: never | undefined;
    /**
     * Telemetry event sent when jupyter has been found in interpreter but we cannot find kernelspec.
     *
     * @type {(never | undefined)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.JupyterInstalledButNotKernelSpecModule]: never | undefined;
    [Telemetry.JupyterStartTimeout]: {
        /**
         * Total time spent in attempting to start and connect to jupyter before giving up.
         *
         * @type {number}
         */
        timeout: number;
    };
    [Telemetry.SubmitCellThroughInput]: never | undefined;
    [Telemetry.Undo]: never | undefined;
    [Telemetry.VariableExplorerFetchTime]: never | undefined;
    [Telemetry.VariableExplorerToggled]: { open: boolean; runByLine: boolean };
    [Telemetry.VariableExplorerVariableCount]: { variableCount: number };
    [Telemetry.WaitForIdleJupyter]: never | undefined;
    [Telemetry.WebviewMonacoStyleUpdate]: never | undefined;
    [Telemetry.WebviewStartup]: { type: string };
    [Telemetry.WebviewStyleUpdate]: never | undefined;
    [Telemetry.RegisterInterpreterAsKernel]: never | undefined;
    /**
     * Telemetry sent when user selects an interpreter to start jupyter server.
     *
     * @type {(never | undefined)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.SelectJupyterInterpreterCommand]: never | undefined;
    [Telemetry.SelectJupyterInterpreter]: {
        /**
         * The result of the selection.
         * notSelected - No interpreter was selected.
         * selected - An interpreter was selected (and configured to have jupyter and notebook).
         * installationCancelled - Installation of jupyter and/or notebook was cancelled for an interpreter.
         *
         * @type {('notSelected' | 'selected' | 'installationCancelled')}
         */
        result?: 'notSelected' | 'selected' | 'installationCancelled';
    };
    [NativeKeyboardCommandTelemetry.ArrowDown]: never | undefined;
    [NativeKeyboardCommandTelemetry.ArrowUp]: never | undefined;
    [NativeKeyboardCommandTelemetry.ChangeToCode]: never | undefined;
    [NativeKeyboardCommandTelemetry.ChangeToMarkdown]: never | undefined;
    [NativeKeyboardCommandTelemetry.DeleteCell]: never | undefined;
    [NativeKeyboardCommandTelemetry.InsertAbove]: never | undefined;
    [NativeKeyboardCommandTelemetry.InsertBelow]: never | undefined;
    [NativeKeyboardCommandTelemetry.Redo]: never | undefined;
    [NativeKeyboardCommandTelemetry.Run]: never | undefined;
    [NativeKeyboardCommandTelemetry.RunAndAdd]: never | undefined;
    [NativeKeyboardCommandTelemetry.RunAndMove]: never | undefined;
    [NativeKeyboardCommandTelemetry.Save]: never | undefined;
    [NativeKeyboardCommandTelemetry.ToggleLineNumbers]: never | undefined;
    [NativeKeyboardCommandTelemetry.ToggleOutput]: never | undefined;
    [NativeKeyboardCommandTelemetry.Undo]: never | undefined;
    [NativeKeyboardCommandTelemetry.Unfocus]: never | undefined;
    [NativeMouseCommandTelemetry.AddToEnd]: never | undefined;
    [NativeMouseCommandTelemetry.ChangeToCode]: never | undefined;
    [NativeMouseCommandTelemetry.ChangeToMarkdown]: never | undefined;
    [NativeMouseCommandTelemetry.DeleteCell]: never | undefined;
    [NativeMouseCommandTelemetry.InsertBelow]: never | undefined;
    [NativeMouseCommandTelemetry.MoveCellDown]: never | undefined;
    [NativeMouseCommandTelemetry.MoveCellUp]: never | undefined;
    [NativeMouseCommandTelemetry.Run]: never | undefined;
    [NativeMouseCommandTelemetry.RunAbove]: never | undefined;
    [NativeMouseCommandTelemetry.RunAll]: never | undefined;
    [NativeMouseCommandTelemetry.RunBelow]: never | undefined;
    [NativeMouseCommandTelemetry.Save]: never | undefined;
    [NativeMouseCommandTelemetry.SelectKernel]: never | undefined;
    [NativeMouseCommandTelemetry.SelectServer]: never | undefined;
    [NativeMouseCommandTelemetry.ToggleVariableExplorer]: never | undefined;
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
    /**
     * Telemetry event sent when getting environment variables for an activated environment has failed.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [EventName.ACTIVATE_ENV_TO_GET_ENV_VARS_FAILED]: {
        /**
         * Whether the activation commands contain the name `conda`.
         *
         * @type {boolean}
         */
        isPossiblyCondaEnv: boolean;
        /**
         * The type of terminal shell created: powershell, cmd, zsh, bash etc.
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
    };
    /**
     * Telemetry event sent once done searching for kernel spec and interpreter for a local connection.
     *
     * @type {{
     *         kernelSpecFound: boolean;
     *         interpreterFound: boolean;
     *     }}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.FindKernelForLocalConnection]: {
        /**
         * Whether a kernel spec was found.
         *
         * @type {boolean}
         */
        kernelSpecFound: boolean;
        /**
         * Whether an interpreter was found.
         *
         * @type {boolean}
         */
        interpreterFound: boolean;
        /**
         * Whether user was prompted to select a kernel spec.
         *
         * @type {boolean}
         */
        promptedToSelect?: boolean;
    };
    /**
     * Telemetry event sent when starting a session for a local connection failed.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.StartSessionFailedJupyter]: undefined | never;
    /**
     * Telemetry event fired if a failure occurs loading a notebook
     */
    [Telemetry.OpenNotebookFailure]: undefined | never;
    /**
     * Telemetry event sent to capture total time taken for completions list to be provided by LS.
     * This is used to compare against time taken by Jupyter.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.CompletionTimeFromLS]: undefined | never;
    /**
     * Telemetry event sent to capture total time taken for completions list to be provided by Jupyter.
     * This is used to compare against time taken by LS.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.CompletionTimeFromJupyter]: undefined | never;
    /**
     * Telemetry event sent to indicate the language used in a notebook
     *
     * @type { language: string }
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.NotebookLanguage]: {
        /**
         * Language found in the notebook if a known language. Otherwise 'unknown'
         */
        language: string;
    };
    /**
     * Telemetry event sent to indicate 'jupyter kernelspec' is not possible.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelSpecNotFound]: undefined | never;
    /**
     * Telemetry event sent to indicate registering a kernel with jupyter failed.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelRegisterFailed]: undefined | never;
    /**
     * Telemetry event sent to every time a kernel enumeration is done
     *
     * @type {...}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelEnumeration]: {
        /**
         * Count of the number of kernels found
         */
        count: number;
        /**
         * Boolean indicating if any are python or not
         */
        isPython: boolean;
        /**
         * Indicates how the enumeration was acquired.
         */
        source: 'cli' | 'connection';
    };
    /**
     * Total time taken to Launch a raw kernel.
     */
    [Telemetry.KernelLauncherPerf]: undefined | never;
    /**
     * Total time taken to find a kernel on disc.
     */
    [Telemetry.KernelFinderPerf]: undefined | never;
    /**
     * Telemetry event sent if there's an error installing a jupyter required dependency
     *
     * @type { product: string }
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.JupyterInstallFailed]: {
        /**
         * Product being installed (jupyter or ipykernel or other)
         */
        product: string;
    };
    /**
     * Telemetry event sent when installing a jupyter dependency
     *
     * @type {product: string}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.UserInstalledModule]: { product: string };
    /**
     * Telemetry event sent to when user customizes the jupyter command line
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.JupyterCommandLineNonDefault]: undefined | never;
    /**
     * Telemetry event sent when a user runs the interactive window with a new file
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.NewFileForInteractiveWindow]: undefined | never;
    /**
     * Telemetry event sent when a kernel picked crashes on startup
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelInvalid]: undefined | never;
    [Telemetry.GatherIsInstalled]: undefined | never;
    [Telemetry.GatherCompleted]: {
        /**
         * result indicates whether the gather was completed to a script, notebook or suffered an internal error.
         */
        result: 'err' | 'script' | 'notebook' | 'unavailable';
    };
    [Telemetry.GatherStats]: {
        linesSubmitted: number;
        cellsSubmitted: number;
        linesGathered: number;
        cellsGathered: number;
    };
    [Telemetry.GatherException]: {
        exceptionType: 'activate' | 'gather' | 'log' | 'reset';
    };
    /**
     * Telemetry event sent when a gathered notebook has been saved by the user.
     */
    [Telemetry.GatheredNotebookSaved]: undefined | never;
    /**
     * Telemetry event sent when the user reports whether Gathered notebook was good or not
     */
    [Telemetry.GatherQualityReport]: { result: 'yes' | 'no' };
    /**
     * Telemetry event sent when the ZMQ native binaries do not work.
     */
    [Telemetry.ZMQNotSupported]: undefined | never;
    /**
     * Telemetry event sent when the ZMQ native binaries do work.
     */
    [Telemetry.ZMQSupported]: undefined | never;
    /**
     * Telemetry event sent with name of a Widget that is used.
     */
    [Telemetry.HashedIPyWidgetNameUsed]: {
        /**
         * Hash of the widget
         */
        hashedName: string;
        /**
         * Where did we find the hashed name (CDN or user environment or remote jupyter).
         */
        source?: 'cdn' | 'local' | 'remote';
        /**
         * Whether we searched CDN or not.
         */
        cdnSearched: boolean;
    };
    /**
     * Telemetry event sent with name of a Widget found.
     */
    [Telemetry.HashedIPyWidgetNameDiscovered]: {
        /**
         * Hash of the widget
         */
        hashedName: string;
        /**
         * Where did we find the hashed name (CDN or user environment or remote jupyter).
         */
        source?: 'cdn' | 'local' | 'remote';
    };
    /**
     * Total time taken to discover all IPyWidgets on disc.
     * This is how long it takes to discover a single widget on disc (from python environment).
     */
    [Telemetry.DiscoverIPyWidgetNamesLocalPerf]: never | undefined;
    /**
     * Something went wrong in looking for a widget.
     */
    [Telemetry.HashedIPyWidgetScriptDiscoveryError]: never | undefined;
    /**
     * Telemetry event sent when an ipywidget module loads. Module name is hashed.
     */
    [Telemetry.IPyWidgetLoadSuccess]: { moduleHash: string; moduleVersion: string };
    /**
     * Telemetry event sent when an ipywidget module fails to load. Module name is hashed.
     */
    [Telemetry.IPyWidgetLoadFailure]: {
        isOnline: boolean;
        moduleHash: string;
        moduleVersion: string;
        // Whether we timedout getting the source of the script (fetching script source in extension code).
        timedout: boolean;
    };
    /**
     * Telemetry event sent when an ipywidget version that is not supported is used & we have trapped this and warned the user abou it.
     */
    [Telemetry.IPyWidgetWidgetVersionNotSupportedLoadFailure]: { moduleHash: string; moduleVersion: string };
    /**
     * Telemetry event sent when an loading of 3rd party ipywidget JS scripts from 3rd party source has been disabled.
     */
    [Telemetry.IPyWidgetLoadDisabled]: { moduleHash: string; moduleVersion: string };
    /**
     * Total time taken to discover a widget script on CDN.
     */
    [Telemetry.DiscoverIPyWidgetNamesCDNPerf]: {
        // The CDN we were testing.
        cdn: string;
        // Whether we managed to find the widget on the CDN or not.
        exists: boolean;
    };
    /**
     * Telemetry sent when we prompt user to use a CDN for IPyWidget scripts.
     * This is always sent when we display a prompt.
     */
    [Telemetry.IPyWidgetPromptToUseCDN]: never | undefined;
    /**
     * Telemetry sent when user does somethign with the prompt displsyed to user about using CDN for IPyWidget scripts.
     */
    [Telemetry.IPyWidgetPromptToUseCDNSelection]: {
        selection: 'ok' | 'cancel' | 'dismissed' | 'doNotShowAgain';
    };
    /**
     * Telemetry event sent to indicate the overhead of syncing the kernel with the UI.
     */
    [Telemetry.IPyWidgetOverhead]: {
        totalOverheadInMs: number;
        numberOfMessagesWaitedOn: number;
        averageWaitTime: number;
        numberOfRegisteredHooks: number;
    };
    /**
     * Telemetry event sent when the widget render function fails (note, this may not be sufficient to capture all failures).
     */
    [Telemetry.IPyWidgetRenderFailure]: never | undefined;
    /**
     * Telemetry event sent when the widget tries to send a kernel message but nothing was listening
     */
    [Telemetry.IPyWidgetUnhandledMessage]: {
        msg_type: string;
    };

    // Telemetry send when we create a notebook for a raw kernel or jupyter
    [Telemetry.RawKernelCreatingNotebook]: never | undefined;
    [Telemetry.JupyterCreatingNotebook]: never | undefined;

    // Raw kernel timing events
    [Telemetry.RawKernelSessionConnect]: never | undefined;
    [Telemetry.RawKernelStartRawSession]: never | undefined;
    [Telemetry.RawKernelProcessLaunch]: never | undefined;

    // Raw kernel single events
    [Telemetry.RawKernelSessionStartSuccess]: never | undefined;
    [Telemetry.RawKernelSessionStartException]: never | undefined;
    [Telemetry.RawKernelSessionStartTimeout]: never | undefined;
    [Telemetry.RawKernelSessionStartUserCancel]: never | undefined;

    // Start Page Events
    [Telemetry.StartPageViewed]: never | undefined;
    [Telemetry.StartPageOpenedFromCommandPalette]: never | undefined;
    [Telemetry.StartPageOpenedFromNewInstall]: never | undefined;
    [Telemetry.StartPageOpenedFromNewUpdate]: never | undefined;
    [Telemetry.StartPageWebViewError]: never | undefined;
    [Telemetry.StartPageTime]: never | undefined;
    [Telemetry.StartPageClickedDontShowAgain]: never | undefined;
    [Telemetry.StartPageClosedWithoutAction]: never | undefined;
    [Telemetry.StartPageUsedAnActionOnFirstTime]: never | undefined;
    [Telemetry.StartPageOpenBlankNotebook]: never | undefined;
    [Telemetry.StartPageOpenBlankPythonFile]: never | undefined;
    [Telemetry.StartPageOpenInteractiveWindow]: never | undefined;
    [Telemetry.StartPageOpenCommandPalette]: never | undefined;
    [Telemetry.StartPageOpenCommandPaletteWithOpenNBSelected]: never | undefined;
    [Telemetry.StartPageOpenSampleNotebook]: never | undefined;
    [Telemetry.StartPageOpenFileBrowser]: never | undefined;
    [Telemetry.StartPageOpenFolder]: never | undefined;
    [Telemetry.StartPageOpenWorkspace]: never | undefined;

    // Run by line events
    [Telemetry.RunByLineStart]: never | undefined;
    [Telemetry.RunByLineStep]: never | undefined;
    [Telemetry.RunByLineStop]: never | undefined;
    [Telemetry.RunByLineVariableHover]: never | undefined;

    // Trusted notebooks events
    [Telemetry.NotebookTrustPromptShown]: never | undefined;
    [Telemetry.TrustNotebook]: never | undefined;
    [Telemetry.TrustAllNotebooks]: never | undefined;
    [Telemetry.DoNotTrustNotebook]: never | undefined;

    // Native notebooks events
    [VSCodeNativeTelemetry.AddCell]: never | undefined;
    [VSCodeNativeTelemetry.DeleteCell]: never | undefined;
    [VSCodeNativeTelemetry.MoveCell]: never | undefined;
    [VSCodeNativeTelemetry.ChangeToCode]: never | undefined;
    [VSCodeNativeTelemetry.ChangeToMarkdown]: never | undefined;
    [VSCodeNativeTelemetry.RunAllCells]: never | undefined;
    [Telemetry.VSCNotebookCellTranslationFailed]: {
        isErrorOutput: boolean; // Whether we're trying to translate an error output when we shuldn't be.
    };
}
