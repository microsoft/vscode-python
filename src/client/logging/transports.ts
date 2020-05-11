// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable:no-any

import * as logform from 'logform';
import * as path from 'path';
import { transports } from 'winston';
import { EXTENSION_ROOT_DIR } from '../constants';
import { ConsoleStreams } from './types';

// tslint:disable-next-line: no-var-requires no-require-imports
const TransportStream = require('winston-transport');

// Create a console-targeting transport that can be added to a winston logger.
export function getConsoleTransport(
    logToConsole: (stream: ConsoleStreams, ...args: any[]) => void,
    formatter: logform.Format
) {
    const formattedMessage = Symbol.for('message');
    class ConsoleTransport extends TransportStream {
        constructor(options?: any) {
            super(options);
        }
        public log?(info: { level: string; message: string; [formattedMessage]: string }, next: () => void): any {
            setImmediate(() => this.emit('logged', info));
            logToConsole(info.level as any, info[formattedMessage] || info.message);
            if (next) {
                next();
            }
        }
    }
    return new ConsoleTransport({
        // We minimize customization.
        format: formatter
    });
}

// Create a file-targeting transport that can be added to a winston logger.
export function getFileTransport(logfile: string, formatter: logform.Format) {
    if (!path.isAbsolute(logfile)) {
        logfile = path.join(EXTENSION_ROOT_DIR, logfile);
    }
    return new transports.File({
        format: formatter,
        filename: logfile,
        handleExceptions: true
    });
}
