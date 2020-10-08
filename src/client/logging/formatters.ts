// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { format } from 'winston';
import { isTestExecution } from '../common/constants';
import { getLevel, LogLevel, LogLevelName } from './levels';

const TIMESTAMP = 'YYYY-MM-DD HH:mm:ss';

// Knobs used when creating a formatter.
export type FormatterOptions = {
    label?: string;
};

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
    return isTestExecution()
        ? `${process.pid} ${levelFormatted} ${timestamp}: ${message}`
        : `${levelFormatted} ${timestamp}: ${message}`;
}

// Return a log entry that can be emitted as-is.
function formatLabeledMessage(level: LogLevelName, timestamp: string, label: string, message: string): string {
    const levelFormatted = normalizeLevel(level);
    return isTestExecution()
        ? `${process.pid} ${levelFormatted} ${label} ${timestamp}: ${message}`
        : `${levelFormatted} ${label} ${timestamp}: ${message}`;
}

// Return a minimal format object that can be used with a "winston"
// logging transport.
function getMinimalFormatter() {
    return format.combine(
        format.timestamp({ format: TIMESTAMP }),
        format.printf(
            // This relies on the timestamp formatter we added above:
            ({ level, message, timestamp }) => formatMessage(level as LogLevelName, timestamp, message)
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
            // This relies on the label and timestamp formatters we added above:
            ({ level, message, label, timestamp }) =>
                formatLabeledMessage(level as LogLevelName, timestamp, label, message)
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
