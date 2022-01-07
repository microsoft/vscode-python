// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../activation/types';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { Commands } from '../../../../common/constants';
import { IDisposableRegistry } from '../../../../common/types';
import { IShebangCodeLensProvider } from '../../../contracts';
import { IPythonPathUpdaterServiceManager } from '../../types';

@injectable()
export class SetShebangInterpreterCommand implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: true };
    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IPythonPathUpdaterServiceManager)
        private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IShebangCodeLensProvider) private readonly shebangCodeLensProvider: IShebangCodeLensProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {}

    public async activate() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Set_ShebangInterpreter, this.setShebangInterpreter.bind(this)),
        );
    }

    protected async setShebangInterpreter(): Promise<void> {
        const shebang = await this.shebangCodeLensProvider.detectShebang(
            this.documentManager.activeTextEditor!.document,
            true,
        );
        if (!shebang) {
            return;
        }

        const isGlobalChange =
            !Array.isArray(this.workspaceService.workspaceFolders) ||
            this.workspaceService.workspaceFolders.length === 0;
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(
            this.documentManager.activeTextEditor!.document.uri,
        );
        const isWorkspaceChange =
            Array.isArray(this.workspaceService.workspaceFolders) &&
            this.workspaceService.workspaceFolders.length === 1;

        if (isGlobalChange) {
            await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Global, 'shebang');
            return;
        }

        if (isWorkspaceChange || !workspaceFolder) {
            await this.pythonPathUpdaterService.updatePythonPath(
                shebang,
                ConfigurationTarget.Workspace,
                'shebang',
                this.workspaceService.workspaceFolders![0].uri,
            );
            return;
        }

        await this.pythonPathUpdaterService.updatePythonPath(
            shebang,
            ConfigurationTarget.WorkspaceFolder,
            'shebang',
            workspaceFolder.uri,
        );
    }
}
