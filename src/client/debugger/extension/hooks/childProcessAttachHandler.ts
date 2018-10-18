// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, DebugSessionCustomEvent, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../common/application/types';
import { swallowExceptions } from '../../../common/utils/decorators';
import { noop } from '../../../common/utils/misc';
import { AttachRequestArguments } from '../../types';
import { ChildProcessLaunched } from './constants';
import { ChildProcessLaunchData, IDebugSessionEventHandlers } from './types';

/**
 * This class is responsible for automatically attaching the debugger to any
 * child processes launched. I.e. this is the classs responsible for multi-proc debugging.
 * @export
 * @class ChildProcessAttachEventHandler
 * @implements {IDebugSessionEventHandlers}
 */
@injectable()
export class ChildProcessAttachEventHandler implements IDebugSessionEventHandlers {
    constructor(@inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) { }

    @swallowExceptions('Handle child process launch')
    public async handleCustomEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event || event.event !== ChildProcessLaunched) {
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
        const args = data.rootStartRequest.arguments;
        // tslint:disable-next-line:no-any
        const config = JSON.parse(JSON.stringify(args)) as any as (AttachRequestArguments & DebugConfiguration);

        config.host = args.request === 'attach' ? args.host! : 'localhost';
        config.port = data.port;
        config.name = `Child Process ${data.processId}`;
        config.request = 'attach';
        return config;
    }
}
