// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as winston from 'winston';
import { IOutputChannel } from '../common/types';
import { CallInfo } from '../common/utils/decorators';
import { getFormatter } from './formatters';
import { LogLevel, resolveLevelName } from './levels';
import { configureLogger, createLogger, getPreDefinedConfiguration, logToAll } from './logger';
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
    configureLogger(globalLogger, getPreDefinedConfiguration());
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
function log(logLevel: LogLevel, ...args: Arguments) {
    logToAll([globalLogger], logLevel, args);
}

export function logVerbose(...args: any[]) {
    log(LogLevel.Info, ...args);
}

export function logError(...args: any[]) {
    log(LogLevel.Error, ...args);
}

export function logInfo(...args: any[]) {
    log(LogLevel.Info, ...args);
}

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
