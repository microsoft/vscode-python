// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, DebugSession, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../common/application/types';
import { noop } from '../../../common/utils/misc';
import { captureTelemetry } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { AttachRequestArguments } from '../../types';
import { IChildProcessAttachService } from './types';

/**
 * This class is responsible for attaching the debugger to any
 * child processes launched. I.e. this is the class responsible for multi-proc debugging.
 * @export
 * @class ChildProcessAttachEventHandler
 * @implements {IChildProcessAttachService}
 */
@injectable()
export class ChildProcessAttachService implements IChildProcessAttachService {
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {}

    @captureTelemetry(EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS)
    public async attach(data: AttachRequestArguments & DebugConfiguration, parentSession: DebugSession): Promise<void> {
        const debugConfig: AttachRequestArguments & DebugConfiguration = data;
        const processId = debugConfig.subProcessId!;
        const folder = this.getRelatedWorkspaceFolder(debugConfig);
        const launched = await this.debugService.startDebugging(folder, debugConfig, parentSession);
        if (!launched) {
            this.appShell.showErrorMessage(`Failed to launch debugger for child process ${processId}`).then(noop, noop);
        }
    }

    private getRelatedWorkspaceFolder(
        config: AttachRequestArguments & DebugConfiguration,
    ): WorkspaceFolder | undefined {
        const workspaceFolder = config.workspaceFolder;
        if (!this.workspaceService.hasWorkspaceFolders || !workspaceFolder) {
            return;
        }
        return this.workspaceService.workspaceFolders!.find((ws) => ws.uri.fsPath === workspaceFolder);
    }
}
