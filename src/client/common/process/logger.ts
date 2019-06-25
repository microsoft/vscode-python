// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, named } from 'inversify';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';

import { traceInfo } from '../logger';
import { IOutputChannel, IPathUtils } from '../types';
import { Logging } from '../utils/localize';
import { IProcessLogger, ProcessServiceEventArgs } from './types';

@injectable()
export class ProcessLogger implements IProcessLogger {
    constructor(@inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel, @inject(IPathUtils) private readonly pathUtils: IPathUtils) {
    }

    public logProcess({ file, args, options }: ProcessServiceEventArgs) {
        const formattedArgs = args.reduce((accumulator, current, index) => index === 0 ? current : `${accumulator} ${current}`, '');
        const currentWorkingDirectory = this.pathUtils.getDisplayName(options.cwd!);
        const info = [
            `> ${this.pathUtils.getDisplayName(file)} ${formattedArgs}`,
            `${Logging.currentWorkingDirectory()} ${currentWorkingDirectory}`
        ].join('\n');

        traceInfo(info);
        this.outputChannel.appendLine(info);
    }
}
