// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';

import { traceInfo } from '../logger';
import { IOutputChannel, IPathUtils } from '../types';
import { Logging } from '../utils/localize';
import { IProcessLogger, ProcessServiceEvent } from './types';

@injectable()
export class ProcessLogger implements IProcessLogger {
    private outputChannel: IOutputChannel;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer, @inject(IPathUtils) private readonly pathUtils: IPathUtils) {
        this.outputChannel = serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    }

    public logProcess({ file, args, options }: ProcessServiceEvent) {
        const formattedArgs = args.reduce((accumulator, current, index) => index === 0 ? current : `${accumulator} ${current}`, '');
        const currentWorkingDirectory = this.pathUtils.getDisplayName(options.cwd!);
        const info = [
            `> ${file} ${formattedArgs}`,
            `${Logging.currentWorkingDirectory()} ${currentWorkingDirectory}`
        ].join('\n');

        traceInfo(info);
        this.outputChannel.appendLine(info);
    }
}
