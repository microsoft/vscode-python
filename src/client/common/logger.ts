// tslint:disable:no-console no-any
import { injectable } from 'inversify';
import * as path from 'path';
import * as util from 'util';
import { createLogger, format, transports } from 'winston';
import { EXTENSION_ROOT_DIR } from '../constants';
import { sendTelemetryEvent } from '../telemetry';
import { isTestExecution } from './constants';
import { ILogger, LogLevel } from './types';

const enableLogging = !isTestExecution() || process.env.VSC_PYTHON_FORCE_LOGGING || process.env.VSC_PYTHON_LOG_FILE;

const consoleFormatter = format.printf(({ level, message, label, timestamp }) => {
    return `${label} ${timestamp} ${level}: ${message}`;
});

const consoleFormat = format.combine(
    format.label({ label: 'Python Extension:' }),
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    consoleFormatter
);

const logger = createLogger({
    transports: [
        new transports.Console({ format: consoleFormat })
    ]
});

const logLevelMap = {
    [LogLevel.Error]: 'error',
    [LogLevel.Information]: 'info',
    [LogLevel.Warning]: 'warn'
};

function log(logLevel: LogLevel, ...args: any[]) {
    const message = util.format(args[0], ...args.slice(1));
    logger.log(logLevelMap[logLevel], message);
}
export function initialize() {
    if (process.env.VSC_PYTHON_LOG_FILE) {
        // We'd like to ensure we capture all errors into a text file.
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

        const logFilePath = path.isAbsolute(process.env.VSC_PYTHON_LOG_FILE) ? process.env.VSC_PYTHON_LOG_FILE :
            path.join(EXTENSION_ROOT_DIR, process.env.VSC_PYTHON_LOG_FILE);
        logger.transports.push(new transports.File({
            format: fileFormat,
            filename: logFilePath,
            handleExceptions: true
        }));
    }

    // Lets hijack all console messages only when on CI.
    if (enableLogging && process.env.TF_BUILD) {
        // tslint:disable-next-line: no-function-expression
        console.log = function () {
            log(LogLevel.Information, ...arguments);
        };
        // tslint:disable-next-line: no-function-expression
        console.info = function () {
            log(LogLevel.Information, ...arguments);
        };
        // tslint:disable-next-line: no-function-expression
        console.warn = function () {
            log(LogLevel.Warning, ...arguments);
        };
        // tslint:disable-next-line: no-function-expression
        console.error = function () {
            log(LogLevel.Error, ...arguments);
        };
        // tslint:disable-next-line: no-function-expression
        console.debug = function () {
            log(LogLevel.Information, ...arguments);
        };
    }
}

@injectable()
export class Logger implements ILogger {
    // tslint:disable-next-line:no-any
    public static error(...args: any[]) {
        new Logger().logError(...args);
    }
    // tslint:disable-next-line:no-any
    public static warn(...args: any[]) {
        new Logger().logWarning(...args);
    }
    // tslint:disable-next-line:no-any
    public static verbose(...args: any[]) {
        new Logger().logInformation(...args);
    }
    public logError(...args: any[]) {
        if (enableLogging) {
            log(LogLevel.Error, ...args);
        }
    }
    public logWarning(...args: any[]) {
        if (enableLogging) {
            log(LogLevel.Warning, ...args);
        }
    }
    public logInformation(...args: any[]) {
        if (enableLogging) {
            log(LogLevel.Information, ...args);
        }
    }
}

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
            function writeSuccess(returnValue?: any) {
                if (logLevel === LogLevel.Error) {
                    return;
                }
                writeToLog(returnValue);
            }
            function writeError(ex: Error) {
                writeToLog(undefined, ex);
            }
            // tslint:disable-next-line:no-any
            function writeToLog(returnValue?: any, ex?: Error) {
                const messagesToLog = [message];
                messagesToLog.push(`Class name = ${className}`);
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
            try {
                // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
                const result = originalMethod.apply(this, args);
                // If method being wrapped returns a promise then wait for it.
                // tslint:disable-next-line:no-unsafe-any
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    // tslint:disable-next-line:prefer-type-cast
                    (result as Promise<void>)
                        .then(data => {
                            writeSuccess(data);
                            return data;
                        })
                        .catch(ex => {
                            writeError(ex);
                        });
                } else {
                    writeSuccess(result);
                }
                return result;
            } catch (ex) {
                writeError(ex);
                throw ex;
            }
        };

        return descriptor;
    };
}
