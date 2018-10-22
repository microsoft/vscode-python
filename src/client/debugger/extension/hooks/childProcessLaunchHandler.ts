// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, DebugSessionCustomEvent, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../common/application/types';
import { swallowExceptions } from '../../../common/utils/decorators';
import { noop } from '../../../common/utils/misc';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { ICustomDebugSessionEventHandlers } from './types';

const eventName = 'ptvsd_subprocess';

type ChildProcessLaunchData = {
    rootProcessId: number;
    initialProcessId: number;
    rootStartRequest: {
        // tslint:disable-next-line:no-banned-terms
        arguments: LaunchRequestArguments | AttachRequestArguments;
        command: 'attach' | 'request';
        seq: number;
        type: string;
    };
    parentProcessId: number;
    processId: number;
    port: number;
};

@injectable()
export class ChildProcessLaunchEventHandler implements ICustomDebugSessionEventHandlers {
    constructor(@inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) { }

    @swallowExceptions('Handle child process launch')
    public async handleEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event || event.event !== eventName) {
            return;
        }
        const data = event.body! as ChildProcessLaunchData;
        const folder = this.getRelatedWorkspaceFolder(data);
        const debugConfig = this.getAttachConfiguration(data);
        const launched = await this.debugService.startDebugging(folder, debugConfig);
        if (!launched) {
            this.appShell.showErrorMessage(`Failed to launch debugger for child process ${data.processId}`).then(noop, noop);
        }
    }
    protected getRelatedWorkspaceFolder(data: ChildProcessLaunchData): WorkspaceFolder | undefined {
        const workspaceFolder = data.rootStartRequest.arguments.workspaceFolder;
        if (!this.workspaceService.hasWorkspaceFolders || !workspaceFolder) {
            return;
        }
        return this.workspaceService.workspaceFolders!.find(ws => ws.uri.fsPath === workspaceFolder);
    }
    protected getAttachConfiguration(data: ChildProcessLaunchData): AttachRequestArguments & DebugConfiguration {
        // tslint:disable-next-line:no-any
        const config = JSON.parse(JSON.stringify(data.rootStartRequest.arguments)) as any as (AttachRequestArguments & DebugConfiguration);

        if (data.rootStartRequest.arguments.request === 'attach') {
            config.host = data.rootStartRequest.arguments.host!;
        }
        config.port = data.port;
        config.name = `Child Process ${data.processId}`;
        config.request = 'attach';
        return config;
    }
}
