// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-console no-any

import { ConsoleStreams, LogLevel } from './types';

const logMethods = {
    log: Symbol.for('log'),
    info: Symbol.for('info'),
    error: Symbol.for('error'),
    debug: Symbol.for('debug'),
    warn: Symbol.for('warn')
};

// Log a message based on "args" to the given console "stream".
export function logToConsole(stream: ConsoleStreams, ...args: any[]) {
    if (['info', 'error', 'warn', 'log', 'debug'].indexOf(stream) === -1) {
        stream = 'log';
    }
    // Further below we monkeypatch the console.log, etc methods.
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
export function monkeypatchConsole(logToFile: (logLevel: LogLevel, ...args: any[]) => void) {
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
