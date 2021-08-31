// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// IMPORTANT: This file should only be importing from the '../client/logging' directory, as we
// delete everything in '../client' except for '../client/logging' before running smoke tests.

import * as winston from 'winston';

// Our custom log levels

export enum LogLevel {
    // Larger numbers are higher priority.
    Error = 40,
    Warn = 30,
    Info = 20,
    Debug = 10,
    Trace = 5,
}
export type LogLevelName = 'ERROR' | 'WARNING' | 'INFORMATION' | 'DEBUG' | 'DEBUG-TRACE';
const logLevelMap: { [K in LogLevel]: LogLevelName } = {
    [LogLevel.Error]: 'ERROR',
    [LogLevel.Warn]: 'WARNING',
    [LogLevel.Info]: 'INFORMATION',
    [LogLevel.Debug]: 'DEBUG',
    [LogLevel.Trace]: 'DEBUG-TRACE',
};
// This can be used for winston.LoggerOptions.levels.
const configLevels: winston.config.AbstractConfigSetLevels = {
    ERROR: 0,
    WARNING: 1,
    INFORMATION: 2,
    DEBUG: 4,
    'DEBUG-TRACE': 5,
};

// Other log levels

// The level names from winston/config.npm.
// See: https://www.npmjs.com/package/winston#logging-levels
type NPMLogLevelName = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';
const npmLogLevelMap: { [K in LogLevel]: NPMLogLevelName } = {
    [LogLevel.Error]: 'error',
    [LogLevel.Warn]: 'warn',
    [LogLevel.Info]: 'info',
    [LogLevel.Debug]: 'debug',
    [LogLevel.Trace]: 'silly',
};

// Lookup functions

// Convert from LogLevel enum to the proper level name.
export function resolveLevelName(
    level: LogLevel,
    // Default to configLevels.
    levels?: winston.config.AbstractConfigSetLevels,
): string | undefined {
    if (levels === undefined) {
        return getLevelName(level);
    }
    if (levels === configLevels) {
        return getLevelName(level);
    }
    if (levels === winston.config.npm.levels) {
        return npmLogLevelMap[level];
    }
    return undefined;
}
function getLevelName(level: LogLevel): LogLevelName | undefined {
    return logLevelMap[level];
}

// Convert from a level name to the actual level.
export function resolveLevel(
    levelName: string,
    // Default to configLevels.
    levels?: winston.config.AbstractConfigSetLevels,
): LogLevel | undefined {
    let levelMap: { [K in LogLevel]: string };
    if (levels === undefined) {
        levelMap = logLevelMap;
    } else if (levels === configLevels) {
        levelMap = logLevelMap;
    } else if (levels === winston.config.npm.levels) {
        levelMap = npmLogLevelMap;
    } else {
        return undefined;
    }
    for (const level of Object.keys(levelMap)) {
        if (typeof level !== 'string' && logLevelMap[level] === levelName) {
            return level;
        }
    }
    return undefined;
}
export function getLevel(name: LogLevelName): LogLevel | undefined {
    return resolveLevel(name);
}
