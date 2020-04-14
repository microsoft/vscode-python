// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { format } from 'winston';
import { FormatterOptions } from './types';

const TIMESTAMP = 'YYYY-MM-DD HH:mm:ss';

// Return a consistent representation of the given log level.
//
// Pascal casing is used so log files get highlighted when viewing
// in VSC and other editors.
function normalizeLevel(level: string): string {
    return `${level.substring(0, 1).toUpperCase()}${level.substring(1)}`;
}

// Return a log entry that can be emitted as-is.
function formatMessage(level: string, timestamp: string, message: string): string {
    level = normalizeLevel(level);
    return `${level} ${timestamp}: ${message}`;
}

// Return a log entry that can be emitted as-is.
function formatLabeledMessage(level: string, timestamp: string, label: string, message: string): string {
    level = normalizeLevel(level);
    return `${level} ${label} ${timestamp}: ${message}`;
}

// Return a minimal format object that can be used with a "winston"
// logging transport.
function getMinimalFormatter() {
    return format.combine(
        format.timestamp({ format: TIMESTAMP }),
        format.printf(
            // a minimal message
            ({ level, message, timestamp }) => formatMessage(level, timestamp, message)
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
            // mostly a minimal message
            ({ level, message, label, timestamp }) => formatLabeledMessage(level, timestamp, label, message)
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
