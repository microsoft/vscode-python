// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import * as util from 'util';
import { createLogger, format, transports } from 'winston';
import * as Transport from 'winston-transport';
import { getOSType, OSType, StopWatch } from './misc';

const formatter = format.printf(({ level, message, timestamp }) => {
    // Pascal casing og log level, so log files get highlighted when viewing in VSC and other editors.
    return `${level.substring(0, 1).toUpperCase()}${level.substring(1)} ${timestamp}: ${message}`;
});

const consoleFormat = format.combine(
    format.colorize({ all: true }),
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    formatter
);

const fileFormat = format.combine(
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    formatter
);

const getFormattedMessage = (...args: {}[]) => (args.length === 0 ? '' : util.format(args[0], ...args.slice(1)));
let logger = createLogger({
    format: consoleFormat,
    level: 'debug',
    transports: [new transports.Console({ format: consoleFormat })]
});

export function info(message: string, ...args: any[]) {
    logger.info(getFormattedMessage(message, ...args));
}
export function debug(message: string, ...args: any[]) {
    logger.debug(getFormattedMessage(message, ...args));
}
export function warn(message: string, ...args: any[]) {
    logger.warn(getFormattedMessage(message, ...args));
}
export function error(message: string, ...args: any[]) {
    logger.error(getFormattedMessage(message, ...args));
}
export function initialize(verbose: boolean, filename?: string) {
    const level = verbose ? 'debug' : 'info';
    const loggerTransports: Transport[] = [new transports.Console({ format: consoleFormat })];
    if (filename && getOSType() !== OSType.Windows) {
        // Don't log to a file on windows, cuz it sucks.
        // We delete the file mid testing, but the file logger on windows craps out when the file is deleted.
        loggerTransports.push(new transports.File({ format: fileFormat, filename: filename }));
    }
    logger = createLogger({ level, transports: loggerTransports });
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
enum LogLevel {
    Information = 'Information',
    Error = 'Error',
    Warning = 'Warning'
}

export function debugDecorator(message: string, options: LogOptions = LogOptions.Arguments | LogOptions.ReturnValue) {
    return trace(message, options);
}
export function errorDecorator(message: string) {
    return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, LogLevel.Error);
}
export function infoDecorator(message: string) {
    return trace(message);
}
export function warnDecorator(message: string) {
    return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, LogLevel.Warning);
}

function trace(message: string, options: LogOptions = LogOptions.None, logLevel?: LogLevel) {
    // tslint:disable-next-line:no-function-expression no-any
    return function(_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function(...args: any[]) {
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
                messagesToLog.push(`Class name = ${className}, completed in ${elapsedTime}ms`);
                if ((options && LogOptions.Arguments) === LogOptions.Arguments) {
                    messagesToLog.push(argsToLogString(args));
                }
                if ((options & LogOptions.ReturnValue) === LogOptions.ReturnValue) {
                    messagesToLog.push(returnValueToLogString(returnValue));
                }
                if (ex) {
                    error(messagesToLog.join(', '), ex);
                } else {
                    info(messagesToLog.join(', '));
                }
            }
            const timer = new StopWatch();
            try {
                trace(`Before ${message}`, options, logLevel);
                // tslint:disable-next-line:no-invalid-this no-unsafe-any
                const result = originalMethod.apply(this, args);
                // If method being wrapped returns a promise then wait for it.
                // tslint:disable-next-line:no-unsafe-any
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    // tslint:disable-next-line:prefer-type-cast
                    (result as Promise<void>)
                        .then(data => {
                            writeSuccess(timer.elapsedTime, data);
                            return data;
                        })
                        .catch(ex => {
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
