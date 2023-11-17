// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as util from 'util';
import { LogOutputChannel } from 'vscode';
import { Arguments, ILogging } from './types';

export class OutputChannelLogger implements ILogging {
    constructor(private readonly channel: LogOutputChannel) {}

    public traceLog(...data: Arguments): void {
        console.log(util.format(...data));
        this.channel.appendLine(util.format(...data));
    }

    public traceError(...data: Arguments): void {
        console.error(util.format(...data));
        this.channel.error(util.format(...data));
    }

    public traceWarn(...data: Arguments): void {
        console.warn(util.format(...data));
        this.channel.warn(util.format(...data));
    }

    public traceInfo(...data: Arguments): void {
        console.info(util.format(...data));
        this.channel.info(util.format(...data));
    }

    public traceVerbose(...data: Arguments): void {
        console.debug(util.format(...data));
        this.channel.debug(util.format(...data));
    }
}
