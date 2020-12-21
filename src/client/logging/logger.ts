// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// IMPORTANT: This file should only be importing from the '../client/logging' directory, as we
// delete everything in '../client' except for '../client/logging' before running smoke tests.

import * as util from 'util';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import { getFormatter } from './formatters';
import { LogLevel, resolveLevelName } from './levels';
import { getConsoleTransport, getFileTransport, isConsoleTransport } from './transports';
import { Arguments } from './util';

export type LoggerConfig = {
    level?: LogLevel;
    file?: {
        logfile: string;
    };
    console?: {
        label?: string;
    };
};

// Create a logger just the way we like it.
export function createLogger(config?: LoggerConfig) {
    const logger = winston.createLogger({
        // We would also set "levels" here.
    });
    if (config) {
        configureLogger(logger, config);
    }
    return logger;
}

interface IConfigurableLogger {
    level: string;
    add(transport: Transport): void;
}

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
            logfile: process.env.VSC_PYTHON_LOG_FILE,
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

    if (config.file) {
        const formatter = getFormatter();
        const transport = getFileTransport(config.file.logfile, formatter);
        logger.add(transport);
    }
    if (config.console) {
        const formatter = getFormatter({ label: config.console.label });
        const transport = getConsoleTransport(formatter);
        logger.add(transport);
    }
}

export interface ILogger {
    transports: unknown[];
    levels: winston.config.AbstractConfigSetLevels;
    log(level: string, message: string): void;
}

// Emit a log message derived from the args to all enabled transports.
export function logToAll(loggers: ILogger[], logLevel: LogLevel, args: Arguments) {
    const message = args.length === 0 ? '' : util.format(args[0], ...args.slice(1));
    for (const logger of loggers) {
        if (logger.transports.length > 0) {
            const levelName = getLevelName(logLevel, logger.levels, isConsoleLogger(logger));
            logger.log(levelName, message);
        }
    }
}

function isConsoleLogger(logger: ILogger): boolean {
    for (const transport of logger.transports) {
        if (isConsoleTransport(transport)) {
            return true;
        }
    }
    return false;
}

function getLevelName(level: LogLevel, levels: winston.config.AbstractConfigSetLevels, isConsole?: boolean): string {
    const levelName = resolveLevelName(level, levels);
    if (levelName) {
        return levelName;
    } else if (isConsole) {
        // XXX Hard-coding this is fragile:
        return 'silly';
    } else {
        return resolveLevelName(LogLevel.Info, levels) || 'info';
    }
}
