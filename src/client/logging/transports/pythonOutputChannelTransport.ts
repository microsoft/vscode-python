// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// IMPORTANT: This file should only be importing from the '../../client/logging' directory, as we
// delete everything in '../../client' except for '../../client/logging' before running smoke tests.

import * as logform from 'logform';
import { EOL } from 'os';
import { OutputChannel } from 'vscode';
import * as Transport from 'winston-transport';

const formattedMessage = Symbol.for('message');

export interface IPythonOutputChannelContent {
    getContent(): Promise<string>;
}

class PythonOutputChannelTransport extends Transport implements IPythonOutputChannelContent {
    private content: string[] = [];

    constructor(private readonly channel: OutputChannel, options?: Transport.TransportStreamOptions) {
        super(options);
    }

    public log?(info: { message: string; [formattedMessage]: string }, next: () => void): void {
        setImmediate(() => this.emit('logged', info));
        const message = info[formattedMessage] || info.message;
        this.channel.appendLine(message);
        this.content.push(message);
        if (next) {
            next();
        }
    }

    public getContent(): Promise<string> {
        return Promise.resolve(this.content.join(EOL));
    }
}

// Create a Python output channel targeting transport that can be added to a winston logger.
export function getPythonOutputChannelTransport(
    channel: OutputChannel,
    formatter: logform.Format,
): PythonOutputChannelTransport {
    return new PythonOutputChannelTransport(channel, {
        // We minimize customization.
        format: formatter,
    });
}
