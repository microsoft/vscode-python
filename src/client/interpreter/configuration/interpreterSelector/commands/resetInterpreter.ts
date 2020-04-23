// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../../common/application/types';
import { Commands } from '../../../../common/constants';
import { IPythonPathUpdaterServiceManager } from '../../types';
import { BaseInterpreterSelectorCommand } from './base';

@injectable()
export class ResetInterpreterCommand extends BaseInterpreterSelectorCommand {
    constructor(
        @inject(IPythonPathUpdaterServiceManager) pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService
    ) {
        super(pythonPathUpdaterService, commandManager, applicationShell, workspaceService);
    }

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.ClearWorkspaceInterpreter, this.resetInterpreter.bind(this))
        );
    }

    public async resetInterpreter() {
        const targetConfig = await this.getConfigTarget();
        if (!targetConfig) {
            return;
        }
        const configTarget = targetConfig.configTarget;
        const wkspace = targetConfig.folderUri;

        await this.pythonPathUpdaterService.updatePythonPath(undefined, configTarget, 'ui', wkspace);
    }
}
