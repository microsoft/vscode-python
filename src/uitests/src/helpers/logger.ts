// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-any

import * as util from 'util';
import { createLogger, format, transports } from 'winston';
import * as Transport from 'winston-transport';

const formatter = format.printf(({ level, message, timestamp }) => {
    // Pascal casing og log level, so log files get highlighted when viewing in VSC and other editors.
    return `${level.substring(0, 1).toUpperCase()}${level.substring(1)} ${timestamp}: ${message}`;
});

const consoleFormat = format.combine(
    format.colorize({ all: true }),
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    formatter
);

const fileFormat = format.combine(
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    formatter
);

const getFormattedMessage = (...args: {}[]) => args.length === 0 ? '' : util.format(args[0], ...args.slice(1));
let logger = createLogger({ format: consoleFormat, level: 'debug', transports: [new transports.Console({ format: consoleFormat })] });

export function info(message: string, ...args: any[]) {
    logger.info(getFormattedMessage(message, ...args));
}
export function debug(message: string, ...args: any[]) {
    logger.debug(getFormattedMessage(message, ...args));
}
export function warn(message: string, ...args: any[]) {
    logger.warn(getFormattedMessage(message, ...args));
}
export function error(message: string, ...args: any[]) {
    logger.error(getFormattedMessage(message, ...args));
}
export function initialize(verbose: boolean, filename?: string) {
    const level = verbose ? 'debug' : 'info';
    const loggerTransports: Transport[] = [new transports.Console({ format: consoleFormat })];
    if (filename) {
        loggerTransports.push(new transports.File({ format: fileFormat, filename: filename }));
    }
    logger = createLogger({ level, transports: loggerTransports });
}
