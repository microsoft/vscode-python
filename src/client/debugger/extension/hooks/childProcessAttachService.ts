// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, DebugSession, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../common/application/types';
import { noop } from '../../../common/utils/misc';
import { SystemVariables } from '../../../common/variables/systemVariables';
import { captureTelemetry } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { AttachRequestArguments, LaunchRequestArguments } from '../../types';
import { ChildProcessLaunchData, IChildProcessAttachService } from './types';

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
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) {}

    @captureTelemetry(EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS)
    public async attach(
        data: ChildProcessLaunchData | (AttachRequestArguments & DebugConfiguration),
        parentSession: DebugSession
    ): Promise<void> {
        let debugConfig: AttachRequestArguments & DebugConfiguration;
        let processId: number;
        if (this.isChildProcessLaunchData(data)) {
            processId = data.processId;
            debugConfig = this.getAttachConfiguration(data);
        } else {
            debugConfig = data;
            processId = debugConfig.subProcessId!;
        }
        const folder = this.getRelatedWorkspaceFolder(debugConfig);
        const launched = await this.debugService.startDebugging(folder, debugConfig, parentSession);
        if (!launched) {
            this.appShell.showErrorMessage(`Failed to launch debugger for child process ${processId}`).then(noop, noop);
        }
    }
    /**
     * Since we're attaching we need to provide path mappings.
     * If not provided, we cannot add breakpoints as we don't have mappings to the actual source.
     * This is because attach automatically assumes remote debugging.
     * Also remember, this code gets executed only when dynamically attaching to child processes.
     * Resolves https://github.com/microsoft/vscode-python/issues/3568
     */
    public fixPathMappings(config: LaunchRequestArguments & AttachRequestArguments & DebugConfiguration) {
        if (!config.workspaceFolder) {
            return;
        }
        if (Array.isArray(config.pathMappings) && config.pathMappings.length > 0) {
            return;
        }
        // If user has provided a `cwd` in their `launch.json`, then we need to use
        // the `cwd` as the localRoot.
        // We cannot expect the debugger to assume remote root is the same as the cwd,
        // As debugger doesn't necessarily know whether the process being attached to is
        // a child process or not.
        const systemVariables = new SystemVariables(undefined, config.workspaceFolder);
        const localRoot =
            config.cwd && config.cwd.length > 0 ? systemVariables.resolveAny(config.cwd) : config.workspaceFolder;
        config.pathMappings = [{ remoteRoot: '.', localRoot }];
    }
    private getRelatedWorkspaceFolder(
        config: AttachRequestArguments & DebugConfiguration
    ): WorkspaceFolder | undefined {
        const workspaceFolder = config.workspaceFolder;
        if (!this.workspaceService.hasWorkspaceFolders || !workspaceFolder) {
            return;
        }
        return this.workspaceService.workspaceFolders!.find((ws) => ws.uri.fsPath === workspaceFolder);
    }
    private getAttachConfiguration(data: ChildProcessLaunchData): AttachRequestArguments & DebugConfiguration {
        const args = data.rootStartRequest.arguments;
        // tslint:disable-next-line:no-any
        const config = (JSON.parse(JSON.stringify(args)) as any) as AttachRequestArguments & DebugConfiguration;
        // tslint:disable-next-line: no-any
        this.fixPathMappings(config as any);
        config.host = args.request === 'attach' ? args.host! : 'localhost';
        config.port = data.port;
        config.name = `Child Process ${data.processId}`;
        config.request = 'attach';
        return config;
    }
    private isChildProcessLaunchData(
        data: ChildProcessLaunchData | (AttachRequestArguments & DebugConfiguration)
    ): data is ChildProcessLaunchData {
        return data.rootStartRequest !== undefined;
    }
}
