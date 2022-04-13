// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ICommandManager } from '../../../../common/application/types';
import { Commands } from '../../../../common/constants';
import { IDisposable, IDisposableRegistry } from '../../../../common/types';
import { IInterpreterService } from '../../../../interpreter/contracts';

@injectable()
export class InterpreterPathCommand implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[],
    ) {}

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.GetSelectedInterpreterPath, (args) => {
                return this._getSelectedInterpreterPath(args);
            }),
        );
    }

    public async _getSelectedInterpreterPath(args: { workspaceFolder: string } | string[]): Promise<string> {
        // If `launch.json` is launching this command, `args.workspaceFolder` carries the workspaceFolder
        // If `tasks.json` is launching this command, `args[1]` carries the workspaceFolder
        const workspaceFolder = 'workspaceFolder' in args ? args.workspaceFolder : args[1] ? args[1] : undefined;
        let workspaceFolderUri;
        try {
            workspaceFolderUri = workspaceFolder ? Uri.parse(workspaceFolder) : undefined;
        } catch (ex) {
            workspaceFolderUri = undefined;
        }

        return (await this.interpreterService.getActiveInterpreter(workspaceFolderUri))?.path ?? 'python';
    }
}
