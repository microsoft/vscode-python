// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// IMPORTANT: This file should only be importing from the '../../client/logging' directory, as we
// delete everything in '../../client' except for '../../client/logging' before running smoke tests.

import * as logform from 'logform';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import { LogLevel, resolveLevel } from '../levels';
import { Arguments } from '../util';

const formattedMessage = Symbol.for('message');

// A winston-compatible transport type.
// We do not use transports.ConsoleTransport because it cannot
// adapt to our custom log levels very well.
export class ConsoleTransport extends Transport {
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

    constructor(
        options?: Transport.TransportStreamOptions,
        private readonly levels?: winston.config.AbstractConfigSetLevels,
    ) {
        super(options);
    }

    public log?(info: { level: string; message: string; [formattedMessage]: string }, next: () => void): void {
        setImmediate(() => this.emit('logged', info));
        const level = resolveLevel(info.level, this.levels);
        const msg = info[formattedMessage] || info.message;
        this.logToConsole(level, msg);
        if (next) {
            next();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private logToConsole(level?: LogLevel, msg?: string) {
        let func = ConsoleTransport.defaultFunc;
        if (level) {
            func = ConsoleTransport.funcByLevel[level] || func;
        }
        func(msg);
    }
}

export function isConsoleTransport(transport: unknown): transport is ConsoleTransport {
    return transport !== undefined && (transport as Record<string, unknown>).hasOwnProperty('isConsole');
}

// Create a console-targeting transport that can be added to a winston logger.
export function getConsoleTransport(formatter: logform.Format): Transport {
    return new ConsoleTransport({
        // We minimize customization.
        format: formatter,
    });
}
