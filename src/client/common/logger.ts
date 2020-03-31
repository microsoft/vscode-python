// tslint:disable:no-console no-any
import * as path from 'path';
import * as util from 'util';
import { createLogger, format, transports } from 'winston';
import { EXTENSION_ROOT_DIR } from '../constants';
import { sendTelemetryEvent } from '../telemetry';
import { isTestExecution } from './constants';
import { LogLevel } from './types';
import { StopWatch } from './utils/stopWatch';

// tslint:disable-next-line: no-var-requires no-require-imports
const TransportStream = require('winston-transport');

// Initialize the loggers as soon as this module is imported.
const consoleLogger = createLogger();
const fileLogger = createLogger();
initializeConsoleLogger();
initializeFileLogger();

const logLevelMap = {
    [LogLevel.Error]: 'error',
    [LogLevel.Information]: 'info',
    [LogLevel.Warning]: 'warn'
};

function log(logLevel: LogLevel, ...args: any[]) {
    if (consoleLogger.transports.length > 0) {
        const message = args.length === 0 ? '' : util.format(args[0], ...args.slice(1));
        consoleLogger.log(logLevelMap[logLevel], message);
    }
    logToFile(logLevel, ...args);
}
function logToFile(logLevel: LogLevel, ...args: any[]) {
    if (fileLogger.transports.length === 0) {
        return;
    }
    const message = args.length === 0 ? '' : util.format(args[0], ...args.slice(1));
    fileLogger.log(logLevelMap[logLevel], message);
}

/**
 * Initialize the logger for console.
 * We do two things here:
 * - Anything written to the logger will be displayed in the console window as well
 *   This is the behavior of the extension when running it.
 *   When running tests on CI, we might not want this behavior, as it'll pollute the
 *      test output with logging (as mentioned this is optional).
 *   Messages logged using our logger will be prefixed with `Python Extension: ....` for console window.
 *   This way, its easy to identify messages specific to the python extension.
 * - Monkey patch the console.log and similar methods to send messages to the file logger.
 *   When running UI tests or similar, and we want to see everything that was dumped into `console window`,
 *      then we need to hijack the console logger.
 *   To do this we need to monkey patch the console methods.
 *   This is optional (generally done when running tests on CI).
 */
// tslint:disable-next-line: max-func-body-length
function initializeConsoleLogger() {
    const logMethods = {
        log: Symbol.for('log'),
        info: Symbol.for('info'),
        error: Symbol.for('error'),
        debug: Symbol.for('debug'),
        warn: Symbol.for('warn')
    };

    function logToConsole(stream: 'info' | 'error' | 'warn' | 'log' | 'debug', ...args: any[]) {
        if (['info', 'error', 'warn', 'log', 'debug'].indexOf(stream) === -1) {
            stream = 'log';
        }
        // Further below we monkeypatch the console.log, etc methods.
        const fn = (console as any)[logMethods[stream]] || console[stream] || console.log;
        fn(...args);
    }

    // Hijack `console.log` when running tests on CI.
    if (process.env.VSC_PYTHON_LOG_FILE && process.env.TF_BUILD) {
        /*
        What we're doing here is monkey patching the console.log so we can send everything sent to console window into our logs.
        This is only required when we're directly writing to `console.log` or not using our `winston logger`.
        This is something we'd generally turn on, only on CI so we can see everything logged to the console window (via the logs).
        */
        // Keep track of the original functions before we monkey patch them.
        // Using symbols guarantee the properties will be unique & prevents clashing with names other code/library may create or have created.
        (console as any)[logMethods.log] = console.log;
        (console as any)[logMethods.info] = console.info;
        (console as any)[logMethods.error] = console.error;
        (console as any)[logMethods.debug] = console.debug;
        (console as any)[logMethods.warn] = console.warn;

        // tslint:disable-next-line: no-function-expression
        console.log = function () {
            const args = Array.prototype.slice.call(arguments);
            logToConsole('log', ...args);
            logToFile(LogLevel.Information, ...args);
        };
        // tslint:disable-next-line: no-function-expression
        console.info = function () {
            const args = Array.prototype.slice.call(arguments);
            logToConsole('info', ...args);
            logToFile(LogLevel.Information, ...args);
        };
        // tslint:disable-next-line: no-function-expression
        console.warn = function () {
            const args = Array.prototype.slice.call(arguments);
            logToConsole('warn', ...args);
            logToFile(LogLevel.Warning, ...args);
        };
        // tslint:disable-next-line: no-function-expression
        console.error = function () {
            const args = Array.prototype.slice.call(arguments);
            logToConsole('error', ...args);
            logToFile(LogLevel.Error, ...args);
        };
        // tslint:disable-next-line: no-function-expression
        console.debug = function () {
            const args = Array.prototype.slice.call(arguments);
            logToConsole('debug', ...args);
            logToFile(LogLevel.Information, ...args);
        };
    }

    if (isTestExecution() && !process.env.VSC_PYTHON_FORCE_LOGGING) {
        // Do not log to console if running tests on CI and we're not asked to do so.
        return;
    }

    // Rest of this stuff is just to instantiate the console logger.
    // I.e. when we use our logger, ensure we also log to the console (for end users).
    const formattedMessage = Symbol.for('message');
    class ConsoleTransport extends TransportStream {
        constructor(options?: any) {
            super(options);
        }
        public log?(info: { level: string; message: string; [formattedMessage]: string }, next: () => void): any {
            setImmediate(() => this.emit('logged', info));
            logToConsole(info.level as any, info[formattedMessage] || info.message);
            if (next) {
                next();
            }
        }
    }
    const consoleFormatter = format.printf(({ level, message, label, timestamp }) => {
        // If we're on CI server, no need for the label (prefix)
        // Pascal casing og log level, so log files get highlighted when viewing in VSC and other editors.
        const prefix = `${level.substring(0, 1).toUpperCase()}${level.substring(1)} ${
            process.env.TF_BUILD ? '' : label
        }`;
        return `${prefix.trim()} ${timestamp}: ${message}`;
    });
    const consoleFormat = format.combine(
        format.label({ label: 'Python Extension:' }),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        consoleFormatter
    );
    consoleLogger.add(new ConsoleTransport({ format: consoleFormat }) as any);
}

/**
 * Send all logging output to a log file.
 * We log to the file only if a file has been specified as an env variable.
 * Currently this is setup on CI servers.
 */
function initializeFileLogger() {
    if (!process.env.VSC_PYTHON_LOG_FILE) {
        return;
    }
    const fileFormatter = format.printf(({ level, message, timestamp }) => {
        // Pascal casing og log level, so log files get highlighted when viewing in VSC and other editors.
        return `${level.substring(0, 1).toUpperCase()}${level.substring(1)} ${timestamp}: ${message}`;
    });
    const fileFormat = format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        fileFormatter
    );
    const logFilePath = path.isAbsolute(process.env.VSC_PYTHON_LOG_FILE)
        ? process.env.VSC_PYTHON_LOG_FILE
        : path.join(EXTENSION_ROOT_DIR, process.env.VSC_PYTHON_LOG_FILE);
    const logFileSink = new transports.File({
        format: fileFormat,
        filename: logFilePath,
        handleExceptions: true
    });
    fileLogger.add(logFileSink);
}

/**
 * What do we want to log.
 * @export
 * @enum {number}
 */
export enum LogOptions {
    None = 0,
    Arguments = 1,
    ReturnValue = 2
}

// tslint:disable-next-line:no-any
function argsToLogString(args: any[]): string {
    try {
        return (args || [])
            .map((item, index) => {
                if (item === undefined) {
                    return `Arg ${index + 1}: undefined`;
                }
                if (item === null) {
                    return `Arg ${index + 1}: null`;
                }
                try {
                    if (item && item.fsPath) {
                        return `Arg ${index + 1}: <Uri:${item.fsPath}>`;
                    }
                    return `Arg ${index + 1}: ${JSON.stringify(item)}`;
                } catch {
                    return `Arg ${index + 1}: <argument cannot be serialized for logging>`;
                }
            })
            .join(', ');
    } catch {
        return '';
    }
}

// tslint:disable-next-line:no-any
function returnValueToLogString(returnValue: any): string {
    const returnValueMessage = 'Return Value: ';
    if (returnValue === undefined) {
        return `${returnValueMessage}undefined`;
    }
    if (returnValue === null) {
        return `${returnValueMessage}null`;
    }
    try {
        return `${returnValueMessage}${JSON.stringify(returnValue)}`;
    } catch {
        return `${returnValueMessage}<Return value cannot be serialized for logging>`;
    }
}

export function traceVerbose(...args: any[]) {
    log(LogLevel.Information, ...args);
}

export function traceError(...args: any[]) {
    log(LogLevel.Error, ...args);
}

export function traceInfo(...args: any[]) {
    log(LogLevel.Information, ...args);
}

export function traceWarning(...args: any[]) {
    log(LogLevel.Warning, ...args);
}

export namespace traceDecorators {
    export function verbose(message: string, options: LogOptions = LogOptions.Arguments | LogOptions.ReturnValue) {
        return trace(message, options);
    }
    export function error(message: string) {
        return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, LogLevel.Error);
    }
    export function info(message: string) {
        return trace(message);
    }
    export function warn(message: string) {
        return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, LogLevel.Warning);
    }
}
function trace(message: string, options: LogOptions = LogOptions.None, logLevel?: LogLevel) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            const className = _ && _.constructor ? _.constructor.name : '';
            // tslint:disable-next-line:no-any
            function writeSuccess(elapsedTime: number, returnValue: any) {
                if (logLevel === LogLevel.Error) {
                    return;
                }
                writeToLog(elapsedTime, returnValue);
            }
            function writeError(elapsedTime: number, ex: Error) {
                writeToLog(elapsedTime, undefined, ex);
            }
            // tslint:disable-next-line:no-any
            function writeToLog(elapsedTime: number, returnValue?: any, ex?: Error) {
                const messagesToLog = [message];
                messagesToLog.push(
                    `Class name = ${className}, completed in ${elapsedTime}ms, has a ${
                        returnValue ? 'truthy' : 'falsy'
                    } return value`
                );
                if ((options && LogOptions.Arguments) === LogOptions.Arguments) {
                    messagesToLog.push(argsToLogString(args));
                }
                if ((options & LogOptions.ReturnValue) === LogOptions.ReturnValue) {
                    messagesToLog.push(returnValueToLogString(returnValue));
                }
                if (ex) {
                    log(LogLevel.Error, messagesToLog.join(', '), ex);
                    sendTelemetryEvent('ERROR' as any, undefined, undefined, ex);
                } else {
                    log(LogLevel.Information, messagesToLog.join(', '));
                }
            }
            const timer = new StopWatch();
            try {
                // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
                const result = originalMethod.apply(this, args);
                // If method being wrapped returns a promise then wait for it.
                // tslint:disable-next-line:no-unsafe-any
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    // tslint:disable-next-line:prefer-type-cast
                    (result as Promise<void>)
                        .then((data) => {
                            writeSuccess(timer.elapsedTime, data);
                            return data;
                        })
                        .catch((ex) => {
                            writeError(timer.elapsedTime, ex);
                        });
                } else {
                    writeSuccess(timer.elapsedTime, result);
                }
                return result;
            } catch (ex) {
                writeError(timer.elapsedTime, ex);
                throw ex;
            }
        };

        return descriptor;
    };
}
