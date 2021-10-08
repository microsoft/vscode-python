// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { isCI, isTestExecution, STANDARD_OUTPUT_CHANNEL } from '../constants';
import { traceInfo } from '../logger';
import { IOutputChannel, IPathUtils } from '../types';
import { Logging } from '../utils/localize';
import { IProcessLogger, SpawnOptions } from './types';

@injectable()
export class ProcessLogger implements IProcessLogger {
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
    ) {}

    public logProcess(fileOrCommand: string, args?: string[], options?: SpawnOptions) {
        if (!isTestExecution() && isCI && process.env.UITEST_DISABLE_PROCESS_LOGGING) {
            // Added to disable logging of process execution commands during UI Tests.
            // Used only during UI Tests (hence this setting need not be exposed as a valid setting).
            return;
        }
        // Note: Single quotes maybe converted to double quotes for printing purposes.
        let commandList: string[];
        if (!args) {
            // It's a quoted command.
            commandList = fileOrCommand.split('" "').map((s) => s.trimQuotes());
        } else {
            commandList = [fileOrCommand, ...args].map((s) => s.trimQuotes());
        }
        const command = commandList.reduce((accumulator, current, index) => {
            const formattedArg = this.pathUtils.getDisplayName(current).toCommandArgument();
            return index === 0 ? formattedArg : `${accumulator} ${formattedArg}`;
        }, '');

        const info = [`> ${command}`];
        if (options && options.cwd) {
            info.push(`${Logging.currentWorkingDirectory()} ${this.pathUtils.getDisplayName(options.cwd)}`);
        }

        info.forEach((line) => {
            traceInfo(line);
            this.outputChannel.appendLine(line);
        });
    }
}
