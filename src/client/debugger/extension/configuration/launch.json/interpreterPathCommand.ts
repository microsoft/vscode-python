// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { Commands } from '../../../../common/constants';
import { IDisposable, IDisposableRegistry } from '../../../../common/types';
import { registerCommand } from '../../../../common/vscodeApis/commandApis';
import { IInterpreterService } from '../../../../interpreter/contracts';

@injectable()
export class InterpreterPathCommand implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[],
    ) {}

    public async activate(): Promise<void> {
        this.disposables.push(
            registerCommand(Commands.GetSelectedInterpreterPath, (args) => this._getSelectedInterpreterPath(args)),
        );
    }

    public async _getSelectedInterpreterPath(args: { workspaceFolder: string } | string[]): Promise<string> {
        // If `launch.json` is launching this command, `args.workspaceFolder` carries the workspaceFolder
        // If `tasks.json` is launching this command, `args[1]` carries the workspaceFolder
        let workspaceFolder;
        if ('workspaceFolder' in args) {
            workspaceFolder = args.workspaceFolder;
        } else if (args[1]) {
            const [, second] = args;
            workspaceFolder = second;
        } else {
            workspaceFolder = undefined;
        }

        let workspaceFolderUri;
        try {
            workspaceFolderUri = workspaceFolder ? Uri.file(workspaceFolder) : undefined;
        } catch (ex) {
            workspaceFolderUri = undefined;
        }

        return (await this.interpreterService.getActiveInterpreter(workspaceFolderUri))?.path ?? 'python';
    }
}
