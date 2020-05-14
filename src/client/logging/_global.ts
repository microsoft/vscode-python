// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as winston from 'winston';
import { isCI } from '../common/constants';
import { IOutputChannel } from '../common/types';
import { CallInfo } from '../common/utils/decorators';
import { getFormatter } from './formatters';
import { LogLevel, resolveLevelName } from './levels';
import { configureLogger, createLogger, ILogger, LoggerConfig, logToAll } from './logger';
import { createTracingDecorator, LogInfo, TraceOptions, tracing as _tracing } from './trace';
import { getPythonOutputChannelTransport } from './transports';
import { Arguments } from './util';

const globalLogger = createLogger();
initialize();

/**
 * Initialize the logger.
 *
 * For console we do two things here:
 * - Anything written to the logger will be displayed in the console
 *   window as well  This is the behavior of the extension when running
 *   it.  When running tests on CI, we might not want this behavior, as
 *   it'll pollute the test output with logging (as mentioned this is
 *   optional).  Messages logged using our logger will be prefixed with
 *   `Python Extension: ....` for console window.  This way, its easy
 *   to identify messages specific to the python extension.
 * - Monkey patch the console.log and similar methods to send messages
 *   to the file logger.  When running UI tests or similar, and we want
 *   to see everything that was dumped into `console window`, then we
 *   need to hijack the console logger.  To do this we need to monkey
 *   patch the console methods.  This is optional (generally done when
 *   running tests on CI).
 *
 * For the logfile:
 * - we send all logging output to a log file.  We log to the file
 *   only if a file has been specified as an env variable.  Currently
 *   this is setup on CI servers.
 */
function initialize() {
    const config: LoggerConfig = {};
    let nonConsole = false;

    // Do not log to console if running tests and we're not
    // asked to do so.
    if (process.env.VSC_PYTHON_FORCE_LOGGING) {
        config.console = {};
        // In CI there's no need for the label.
        if (!isCI) {
            config.console.label = 'Python Extension:';
        }
    }
    if (process.env.VSC_PYTHON_LOG_FILE) {
        config.file = {
            logfile: process.env.VSC_PYTHON_LOG_FILE
        };
        nonConsole = true;
    }
    configureLogger(globalLogger, config);

    if (isCI && nonConsole) {
        delete config.console;
        // Send console.*() to the non-console loggers.
        monkeypatchConsole(
            // This is a separate logger that matches our config but
            // does not do any console logging.
            createLogger(config)
        );
    }
}

// Set the logging level the extension logs at.
export function setLoggingLevel(level: LogLevel | 'off') {
    if (level === 'off') {
        // For now we disable all logging. One alternative would be
        // to only disable logging to the output channel (by removing
        // the transport from the logger).
        globalLogger.clear();
    } else {
        const levelName = resolveLevelName(level, winston.config.npm.levels);
        if (levelName) {
            globalLogger.level = levelName;
        }
    }
}

// Register the output channel transport the logger will log into.
export function addOutputChannelLogging(channel: IOutputChannel) {
    const formatter = getFormatter();
    const transport = getPythonOutputChannelTransport(channel, formatter);
    globalLogger.add(transport);
}

// Emit a log message derived from the args to all enabled transports.
export function log(logLevel: LogLevel, ...args: Arguments) {
    logToAll([globalLogger], logLevel, args);
}

// tslint:disable-next-line:no-any
export function logVerbose(...args: any[]) {
    log(LogLevel.Info, ...args);
}

// tslint:disable-next-line:no-any
export function logError(...args: any[]) {
    log(LogLevel.Error, ...args);
}

// tslint:disable-next-line:no-any
export function logInfo(...args: any[]) {
    log(LogLevel.Info, ...args);
}

// tslint:disable-next-line:no-any
export function logWarning(...args: any[]) {
    log(LogLevel.Warn, ...args);
}

// This is like a "context manager" that logs tracing info.
export function tracing<T>(info: LogInfo, run: () => T, call?: CallInfo): T {
    return _tracing([globalLogger], info, run, call);
}

export namespace traceDecorators {
    const DEFAULT_OPTS: TraceOptions = TraceOptions.Arguments | TraceOptions.ReturnValue;

    export function verbose(message: string, opts: TraceOptions = DEFAULT_OPTS) {
        return createTracingDecorator([globalLogger], { message, opts });
    }
    export function error(message: string) {
        const opts = DEFAULT_OPTS;
        const level = LogLevel.Error;
        return createTracingDecorator([globalLogger], { message, opts, level });
    }
    export function info(message: string) {
        const opts = TraceOptions.None;
        return createTracingDecorator([globalLogger], { message, opts });
    }
    export function warn(message: string) {
        const opts = DEFAULT_OPTS;
        const level = LogLevel.Warn;
        return createTracingDecorator([globalLogger], { message, opts, level });
    }
}

/**
 * What we're doing here is monkey patching the console.log so we can
 * send everything sent to console window into our logs.  This is only
 * required when we're directly writing to `console.log` or not using
 * our `winston logger`.  This is something we'd generally turn on, only
 * on CI so we can see everything logged to the console window
 * (via the logs).
 */
function monkeypatchConsole(logger: ILogger) {
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
            logToAll([logger], level, args);
        };
    }
}
