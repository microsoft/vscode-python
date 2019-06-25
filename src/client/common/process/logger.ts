// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { window } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';

import { traceInfo } from '../logger';
import { IOutputChannel } from '../types';
import { Logging } from '../utils/localize';
import { IProcessLogger, ProcessServiceEvent } from './types';

@injectable()
export class ProcessLogger implements IProcessLogger {
    private outputChannel: IOutputChannel;
    private workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.outputChannel = serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public logProcess({ file, args, options }: ProcessServiceEvent) {
        const formattedArgs = args.reduce((accumulator, current, index) => index === 0 ? current : `${accumulator} ${current}`, '');
        let currentWorkingDirectory;

        if (this.workspaceService.hasWorkspaceFolders) {
            currentWorkingDirectory = this.workspaceService.workspaceFolders![0].uri.fsPath;
        } else {
            const openFile = window.activeTextEditor !== undefined ? window.activeTextEditor.document.uri : undefined;
            currentWorkingDirectory = openFile ? path.dirname(openFile.fsPath) : options.cwd!;
        }
        const info = [
            `> ${file} ${formattedArgs}`,
            `${Logging.currentWorkingDirectory()} ${currentWorkingDirectory}`
        ].join('\n');

        traceInfo(info);
        this.outputChannel.appendLine(info);
    }
}
