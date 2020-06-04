// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// IMPORTANT: This file should only be importing from the '../client/logging' directory, as we
// delete everything in '../client' except for '../client/logging' before running smoke tests.

import * as logform from 'logform';
import * as path from 'path';
import { OutputChannel } from 'vscode';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import { LogLevel, resolveLevel } from './levels';
import { Arguments } from './util';

const folderPath = path.dirname(__dirname);
const folderName = path.basename(folderPath);
const EXTENSION_ROOT_DIR =
    folderName === 'client' ? path.join(folderPath, '..', '..') : path.join(folderPath, '..', '..', '..', '..');
const formattedMessage = Symbol.for('message');

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

class PythonOutputChannelTransport extends Transport {
    // tslint:disable-next-line: no-any
    constructor(private readonly channel: OutputChannel, options?: any) {
        super(options);
    }
    // tslint:disable-next-line: no-any
    public log?(info: { message: string; [formattedMessage]: string }, next: () => void): any {
        setImmediate(() => this.emit('logged', info));
        this.channel.appendLine(info[formattedMessage] || info.message);
        if (next) {
            next();
        }
    }
}

// Create a Python output channel targeting transport that can be added to a winston logger.
export function getPythonOutputChannelTransport(channel: OutputChannel, formatter: logform.Format) {
    return new PythonOutputChannelTransport(channel, {
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
