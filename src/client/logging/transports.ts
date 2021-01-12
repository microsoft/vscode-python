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

export function isConsoleTransport(transport: unknown): boolean {
    return (transport as any).isConsole;
}

// A winston-compatible transport type.
// We do not use transports.ConsoleTransport because it cannot
// adapt to our custom log levels very well.
class ConsoleTransport extends Transport {
    private static funcByLevel: { [K in LogLevel]: (...args: Arguments) => void } = {
        [LogLevel.Error]: console.error,
        [LogLevel.Warn]: console.warn,
        [LogLevel.Info]: console.info,
        [LogLevel.Debug]: console.debug,
        [LogLevel.Trace]: console.trace,
    };
    private static defaultFunc = console.log;

    // This is used to identify the type.
    public readonly isConsole = true;

    constructor(options?: any, private readonly levels?: winston.config.AbstractConfigSetLevels) {
        super(options);
    }

    public log?(info: { level: string; message: string; [formattedMessage]: string }, next: () => void): any {
        setImmediate(() => this.emit('logged', info));
        const level = resolveLevel(info.level, this.levels);
        const msg = info[formattedMessage] || info.message;
        this.logToConsole(level, msg);
        if (next) {
            next();
        }
    }

    private logToConsole(level?: LogLevel, msg?: string) {
        let func = ConsoleTransport.defaultFunc;
        if (level) {
            func = ConsoleTransport.funcByLevel[level] || func;
        }
        func(msg);
    }
}

// Create a console-targeting transport that can be added to a winston logger.
export function getConsoleTransport(formatter: logform.Format): Transport {
    return new ConsoleTransport({
        // We minimize customization.
        format: formatter,
    });
}

class PythonOutputChannelTransport extends Transport {
    constructor(private readonly channel: OutputChannel, options?: any) {
        super(options);
    }

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
        format: formatter,
    });
}

// Create a file-targeting transport that can be added to a winston logger.
export function getFileTransport(logfile: string, formatter: logform.Format): Transport {
    if (!path.isAbsolute(logfile)) {
        logfile = path.join(EXTENSION_ROOT_DIR, logfile);
    }
    return new winston.transports.File({
        format: formatter,
        filename: logfile,
        handleExceptions: true,
    });
}
