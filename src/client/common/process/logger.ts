// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, named } from 'inversify';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';

import { traceInfo } from '../logger';
import { IOutputChannel, IPathUtils } from '../types';
import { Logging } from '../utils/localize';
import { IProcessLogger, SpawnOptions } from './types';

@injectable()
export class ProcessLogger implements IProcessLogger {
    constructor(@inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel, @inject(IPathUtils) private readonly pathUtils: IPathUtils) { }

    public logProcess(file: string, args: string[], options?: SpawnOptions) {
        const formattedArgs = args.reduce((accumulator, current, index) => index === 0 ? current : `${accumulator} ${current}`, '');
        const currentWorkingDirectory = options && options.cwd ? this.pathUtils.getDisplayName(options.cwd!) : undefined;
        let info = `> ${this.pathUtils.getDisplayName(file)} ${formattedArgs}`;

        if (currentWorkingDirectory) {
            info += `\n${Logging.currentWorkingDirectory()} ${currentWorkingDirectory}`;
        }

        traceInfo(info);
        this.outputChannel.appendLine(info);
    }
}
