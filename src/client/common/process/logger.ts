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

    public logProcess(file: string, args: string[], options?: SpawnOptions) {
        if (!isTestExecution() && isCI && process.env.UITEST_DISABLE_PROCESS_LOGGING) {
            // Added to disable logging of process execution commands during UI Tests.
            // Used only during UI Tests (hence this setting need not be exposed as a valid setting).
            return;
        }
        const argsList = args.reduce((accumulator, current, index) => {
            let formattedArg = this.pathUtils.getDisplayName(current).toCommandArgument();
            if (current[0] === "'" || current[0] === '"') {
                formattedArg = `${current[0]}${this.pathUtils.getDisplayName(current.substr(1))}`;
            }

            return index === 0 ? formattedArg : `${accumulator} ${formattedArg}`;
        }, '');

        const info = [`> ${this.pathUtils.getDisplayName(file)} ${argsList}`];
        if (options && options.cwd) {
            info.push(`${Logging.currentWorkingDirectory()} ${this.pathUtils.getDisplayName(options.cwd)}`);
        }

        info.forEach((line) => {
            traceInfo(line);
            this.outputChannel.appendLine(line);
        });
    }
}
