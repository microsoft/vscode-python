// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ICommandManager } from '../../../../common/application/types';
import { Commands } from '../../../../common/constants';
import { IConfigurationService, IDisposable, IDisposableRegistry } from '../../../../common/types';

@injectable()
export class InterpreterPathCommand implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposable[]
    ) {}

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.GetSelectedInterpreterPath, (args) => {
                return this.getSelectedInterpreterPath(args);
            })
        );
    }

    public getSelectedInterpreterPath(args: { workspaceFolder: string } | string[]): string {
        // If `launch.json` is launching this command, `args.workspaceFolder` carries the workspaceFolder
        // If `tasks.json` is launching this command, `args[1]` carries the workspaceFolder
        const workspaceFolder = 'workspaceFolder' in args ? args.workspaceFolder : args[1];
        let p = this.configurationService.getSettings(Uri.parse(workspaceFolder)).pythonPath;
        p = p.replace(/\\/g, '/');
        return p;
    }
}
