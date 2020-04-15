// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as logform from 'logform';
import * as path from 'path';
import * as winston from 'winston';
import { EXTENSION_ROOT_DIR } from '../constants';
import { LogLevel, resolveLevel } from './levels';

// tslint:disable-next-line: no-var-requires no-require-imports
const TransportStream = require('winston-transport');

const formattedMessage = Symbol.for('message');

// A winston-compatible transport type.
class ConsoleTransport extends TransportStream {
    constructor(
        // tslint:disable-next-line:no-any
        private readonly logToConsole: (level: LogLevel | undefined, ...args: any[]) => void,
        // tslint:disable-next-line:no-any
        options?: any,
        private readonly levels?: winston.config.AbstractConfigSetLevels
    ) {
        super(options);
    }

    // tslint:disable-next-line:no-any
    public log?(info: { level: string; message: string; [formattedMessage]: string }, next: () => void): any {
        setImmediate(() => this.emit('logged', info));
        const level = resolveLevel(info.level, this.levels);
        const msg = info[formattedMessage] || info.message;
        this.logToConsole(level, msg);
        if (next) {
            next();
        }
    }
}

// Create a console-targeting transport that can be added to a winston logger.
export function getConsoleTransport(
    // tslint:disable-next-line:no-any
    logToConsole: (level: LogLevel | undefined, ...args: any[]) => void,
    formatter: logform.Format
) {
    return new ConsoleTransport(logToConsole, {
        // We minimize customization.
        format: formatter
    });
}

// Create a file-targeting transport that can be added to a winston logger.
export function getFileTransport(logfile: string, formatter: logform.Format) {
    if (!path.isAbsolute(logfile)) {
        logfile = path.join(EXTENSION_ROOT_DIR, logfile);
    }
    return new winston.transports.File({
        format: formatter,
        filename: logfile,
        handleExceptions: true
    });
}
