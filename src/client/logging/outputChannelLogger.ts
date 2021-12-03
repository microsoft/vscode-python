// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as util from 'util';
import { OutputChannel } from 'vscode';
import { Arguments, ILogging } from './types';
import { getTimeForLogging } from './util';

function formatMessage(level?: string, ...data: Arguments): string {
    return level ? `[${level.toUpperCase()} ${getTimeForLogging()}]: ${util.format(...data)}` : util.format(...data);
}

export class OutputChannelLogger implements ILogging {
    constructor(private readonly channel: OutputChannel) {}

    public traceLog(...data: Arguments): void {
        this.channel.appendLine(util.format(...data));
    }

    public traceError(...data: Arguments): void {
        this.channel.appendLine(formatMessage('error', ...data));
    }

    public traceWarn(...data: Arguments): void {
        this.channel.appendLine(formatMessage('warn', ...data));
    }

    public traceInfo(...data: Arguments): void {
        this.channel.appendLine(formatMessage('info', ...data));
    }

    public traceVerbose(...data: Arguments): void {
        this.channel.appendLine(formatMessage('debug', ...data));
    }
}
