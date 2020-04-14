// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-console no-any

import * as path from 'path';
import * as util from 'util';
import { createLogger, transports } from 'winston';
import { isTestExecution } from '../common/constants';
import { EXTENSION_ROOT_DIR } from '../constants';
import { getFormatter } from './formatters';
import { LogLevel } from './types';

// tslint:disable-next-line: no-var-requires no-require-imports
const TransportStream = require('winston-transport');

// Initialize the loggers as soon as this module is imported.
const consoleLogger = createLogger();
const fileLogger = createLogger();
initializeConsoleLogger();
initializeFileLogger();

// Convert from LogLevel enum to node console "stream" (logger method).
const logLevelMap = {
    [LogLevel.Error]: 'error',
    [LogLevel.Information]: 'info',
    [LogLevel.Warning]: 'warn'
};

// Emit a log message derived from the args to all enabled transports.
export function _log(logLevel: LogLevel, ...args: any[]) {
    if (consoleLogger.transports.length > 0) {
        const message = args.length === 0 ? '' : util.format(args[0], ...args.slice(1));
        consoleLogger.log(logLevelMap[logLevel], message);
    }
    logToFile(logLevel, ...args);
}

// Emit a log message derived from the args to a file, if enabled.
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
    consoleLogger.add(
        new ConsoleTransport({
            // In CI there's no need for the label.
            format: getFormatter({ label: process.env.TF_BUILD ? undefined : 'Python Extension:' })
        }) as any
    );
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
    const logFilePath = path.isAbsolute(process.env.VSC_PYTHON_LOG_FILE)
        ? process.env.VSC_PYTHON_LOG_FILE
        : path.join(EXTENSION_ROOT_DIR, process.env.VSC_PYTHON_LOG_FILE);
    const logFileSink = new transports.File({
        format: getFormatter(),
        filename: logFilePath,
        handleExceptions: true
    });
    fileLogger.add(logFileSink);
}
