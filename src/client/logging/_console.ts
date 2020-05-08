// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-console

import { LogLevel } from './levels';
// Ensure that the console functions are bound before monkeypatching.
import './transports';
import { Arguments } from './util';

/**
 * What we're doing here is monkey patching the console.log so we can
 * send everything sent to console window into our logs.  This is only
 * required when we're directly writing to `console.log` or not using
 * our `winston logger`.  This is something we'd generally turn on, only
 * on CI so we can see everything logged to the console window
 * (via the logs).
 */
export function monkeypatchConsole(log: (logLevel: LogLevel, ...args: Arguments) => void) {
    // The logging "streams" (methods) of the node console.
    const streams = ['log', 'error', 'warn', 'info', 'debug', 'trace'];
    const levels: { [key: string]: LogLevel } = {
        error: LogLevel.Error,
        warn: LogLevel.Warn
    };
    // tslint:disable-next-line:no-any
    const consoleAny: any = console;
    for (const stream of streams) {
        // Using symbols guarantee the properties will be unique & prevents
        // clashing with names other code/library may create or have created.
        // We could use a closure but it's a bit trickier.
        const sym = Symbol.for(stream);
        consoleAny[sym] = consoleAny[stream];
        // tslint:disable-next-line: no-function-expression
        consoleAny[stream] = function () {
            const args = Array.prototype.slice.call(arguments);
            const fn = consoleAny[sym];
            fn(...args);
            const level = levels[stream] || LogLevel.Info;
            log(level, ...args);
        };
    }
}
