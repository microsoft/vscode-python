// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../common/application/types';
import { noop } from '../../../common/utils/misc';
import { captureTelemetry } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { AttachRequestArguments } from '../../types';
import { ChildProcessLaunchData, IChildProcessAttachService } from './types';

/**
 * This class is responsible for attaching the debugger to any
 * child processes launched. I.e. this is the classs responsible for multi-proc debugging.
 * @export
 * @class ChildProcessAttachEventHandler
 * @implements {IChildProcessAttachService}
 */
@injectable()
export class ChildProcessAttachService implements IChildProcessAttachService {
    constructor(@inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) { }

    @captureTelemetry(EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS)
    public async attach(data: ChildProcessLaunchData): Promise<void> {
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
