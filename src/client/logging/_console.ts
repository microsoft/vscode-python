// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-console

import { LogLevel } from './levels';

// The logging "streams" (methods) of the node console.
type ConsoleStream = 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Convert from LogLevel enum to node console "stream" (logger method).
const streamByLevel: { [K in LogLevel]: ConsoleStream } = {
    [LogLevel.Error]: 'error',
    [LogLevel.Warn]: 'warn',
    [LogLevel.Info]: 'info',
    [LogLevel.Debug]: 'debug',
    [LogLevel.Trace]: 'trace'
};

const logMethods = {
    log: Symbol.for('log'),
    error: Symbol.for('error'),
    warn: Symbol.for('warn'),
    info: Symbol.for('info'),
    debug: Symbol.for('debug'),
    trace: Symbol.for('trace')
};

// tslint:disable-next-line:no-any
type Arguments = any[];

// Log a message based on "args" to the given console "stream".
export function logToConsole(level: LogLevel | undefined, ...args: Arguments) {
    const stream = (level ? streamByLevel[level] : undefined) || 'log';
    // Further below we monkeypatch the console.log, etc methods.
    // tslint:disable-next-line:no-any
    const fn = (console as any)[logMethods[stream]] || console[stream] || console.log;
    fn(...args);
}

/**
 * What we're doing here is monkey patching the console.log so we can
 * send everything sent to console window into our logs.  This is only
 * required when we're directly writing to `console.log` or not using
 * our `winston logger`.  This is something we'd generally turn on, only
 * on CI so we can see everything logged to the console window
 * (via the logs).
 */
export function monkeypatchConsole(logToFile: (logLevel: LogLevel, ...args: Arguments) => void) {
    // Keep track of the original functions before we monkey patch them.
    // Using symbols guarantee the properties will be unique & prevents clashing with names other code/library may create or have created.
    // tslint:disable:no-any
    (console as any)[logMethods.log] = console.log;
    (console as any)[logMethods.info] = console.info;
    (console as any)[logMethods.error] = console.error;
    (console as any)[logMethods.debug] = console.debug;
    (console as any)[logMethods.trace] = console.trace;
    (console as any)[logMethods.warn] = console.warn;
    // tslint:enable:no-any

    // tslint:disable-next-line: no-function-expression
    console.log = function () {
        const args = Array.prototype.slice.call(arguments);
        logToConsole(undefined, ...args);
        logToFile(LogLevel.Info, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.info = function () {
        const args = Array.prototype.slice.call(arguments);
        logToConsole(LogLevel.Info, ...args);
        logToFile(LogLevel.Info, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.warn = function () {
        const args = Array.prototype.slice.call(arguments);
        logToConsole(LogLevel.Warn, ...args);
        logToFile(LogLevel.Warn, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.error = function () {
        const args = Array.prototype.slice.call(arguments);
        logToConsole(LogLevel.Error, ...args);
        logToFile(LogLevel.Error, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.debug = function () {
        const args = Array.prototype.slice.call(arguments);
        logToConsole(LogLevel.Debug, ...args);
        logToFile(LogLevel.Info, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.trace = function () {
        const args = Array.prototype.slice.call(arguments);
        logToConsole(LogLevel.Trace, ...args);
        logToFile(LogLevel.Info, ...args);
    };
}
