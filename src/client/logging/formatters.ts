// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { format } from 'winston';
import { getLevel, LogLevel, LogLevelName } from './levels';
import { FormatterOptions } from './types';

const TIMESTAMP = 'YYYY-MM-DD HH:mm:ss';

// Pascal casing is used so log files get highlighted when viewing
// in VSC and other editors.
const formattedLogLevels: { [K in LogLevel]: string } = {
    [LogLevel.Error]: 'Error',
    [LogLevel.Warn]: 'Warn',
    [LogLevel.Info]: 'Info',
    [LogLevel.Debug]: 'Debug',
    [LogLevel.Trace]: 'Trace'
};

// Return a consistent representation of the given log level.
function normalizeLevel(name: LogLevelName): string {
    const level = getLevel(name);
    if (level) {
        const norm = formattedLogLevels[level];
        if (norm) {
            return norm;
        }
    }
    return `${name.substring(0, 1).toUpperCase()}${name.substring(1).toLowerCase()}`;
}

// Return a log entry that can be emitted as-is.
function formatMessage(level: LogLevelName, timestamp: string, message: string): string {
    const levelFormatted = normalizeLevel(level);
    return `${levelFormatted} ${timestamp}: ${message}`;
}

// Return a log entry that can be emitted as-is.
function formatLabeledMessage(level: LogLevelName, timestamp: string, label: string, message: string): string {
    const levelFormatted = normalizeLevel(level);
    return `${levelFormatted} ${label} ${timestamp}: ${message}`;
}

// Return a minimal format object that can be used with a "winston"
// logging transport.
function getMinimalFormatter() {
    return format.combine(
        format.timestamp({ format: TIMESTAMP }),
        format.printf(
            // tslint:disable-next-line:no-any
            ({ level, message, timestamp }) => formatMessage(level as any, timestamp, message)
        )
    );
}

// Return a minimal format object that can be used with a "winston"
// logging transport.
function getLabeledFormatter(label_: string) {
    return format.combine(
        format.label({ label: label_ }),
        format.timestamp({ format: TIMESTAMP }),
        format.printf(
            // tslint:disable-next-line:no-any
            ({ level, message, label, timestamp }) => formatLabeledMessage(level as any, timestamp, label, message)
        )
    );
}

// Return a format object that can be used with a "winston" logging transport.
export function getFormatter(opts: FormatterOptions = {}) {
    if (opts.label) {
        return getLabeledFormatter(opts.label);
    }
    return getMinimalFormatter();
}
