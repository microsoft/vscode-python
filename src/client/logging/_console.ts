// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-console

import { LogLevel } from './levels';

// tslint:disable-next-line:no-any
type Arguments = any[];

/**
 * What we're doing here is monkey patching the console.log so we can
 * send everything sent to console window into our logs.  This is only
 * required when we're directly writing to `console.log` or not using
 * our `winston logger`.  This is something we'd generally turn on, only
 * on CI so we can see everything logged to the console window
 * (via the logs).
 */
// tslint:disable-next-line:no-any
export function monkeypatchConsole(log: (logLevel: LogLevel, ...args: Arguments) => void) {
    // tslint:disable-next-line: no-function-expression
    console.log = function () {
        const args = Array.prototype.slice.call(arguments);
        log((undefined as unknown) as LogLevel, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.info = function () {
        const args = Array.prototype.slice.call(arguments);
        log(LogLevel.Info, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.warn = function () {
        const args = Array.prototype.slice.call(arguments);
        log(LogLevel.Warn, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.error = function () {
        const args = Array.prototype.slice.call(arguments);
        log(LogLevel.Error, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.debug = function () {
        const args = Array.prototype.slice.call(arguments);
        log(LogLevel.Info, ...args);
    };
    // tslint:disable-next-line: no-function-expression
    console.trace = function () {
        const args = Array.prototype.slice.call(arguments);
        log(LogLevel.Info, ...args);
    };
}
