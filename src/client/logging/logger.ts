// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// IMPORTANT: This file should only be importing from the '../client/logging' directory, as we
// delete everything in '../client' except for '../client/logging' before running smoke tests.

import * as util from 'util';
import { createLogger } from 'winston';
import { isTestExecution } from '../common/constants';
import { logToConsole, monkeypatchConsole } from './_console';
import { getFormatter } from './formatters';
import { getConsoleTransport, getFileTransport } from './transports';
import { LogLevel } from './types';

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

interface IConfigurableLogger {
    level: string;
    add(transport: Transport): void;
}

// tslint:disable-next-line: no-suspicious-comment
/**
 * TODO: We should actually have this method in `./_global.ts` as this is exported globally.
 * But for some reason, importing '../client/logging/_global' fails when launching the tests.
 * More details in the comment https://github.com/microsoft/vscode-python/pull/11897#discussion_r433954993
 * https://github.com/microsoft/vscode-python/issues/12137
 */
export function getPreDefinedConfiguration(): LoggerConfig {
    const config: LoggerConfig = {};

    // Do not log to console if running tests and we're not
    // asked to do so.
    if (process.env.VSC_PYTHON_FORCE_LOGGING) {
        config.console = {};
        // In CI there's no need for the label.
        const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;
        if (!isCI) {
            config.console.label = 'Python Extension:';
        }
    }
    if (process.env.VSC_PYTHON_LOG_FILE) {
        config.file = {
            logfile: process.env.VSC_PYTHON_LOG_FILE
        };
    }
    return config;
}

// Set up a logger just the way we like it.
export function configureLogger(logger: IConfigurableLogger, config: LoggerConfig) {
    if (config.level) {
        const levelName = resolveLevelName(config.level);
        if (levelName) {
            logger.level = levelName;
        }
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
function initializeConsoleLogger() {
    // Hijack `console.log` when running tests on CI.
    if (process.env.VSC_PYTHON_LOG_FILE && process.env.TF_BUILD) {
        monkeypatchConsole(logToFile);
    }

    if (isTestExecution() && !process.env.VSC_PYTHON_FORCE_LOGGING) {
        // Do not log to console if running tests on CI and we're not asked to do so.
        return;
    }

    // Rest of this stuff is just to instantiate the console logger.
    // I.e. when we use our logger, ensure we also log to the console (for end users).
    const formatter = getFormatter({
        // In CI there's no need for the label.
        label: process.env.TF_BUILD ? undefined : 'Python Extension:'
    });
    const transport = getConsoleTransport(logToConsole, formatter);
    consoleLogger.add(transport as any);
}

/**
 * Send all logging output to a log file.
 * We log to the file only if a file has been specified as an env variable.
 * Currently this is setup on CI servers.
 */
function initializeFileLogger() {
    const logfile = process.env.VSC_PYTHON_LOG_FILE;
    if (!logfile) {
        return;
    }
    const formatter = getFormatter();
    const transport = getFileTransport(logfile, formatter);
    fileLogger.add(transport);
}
