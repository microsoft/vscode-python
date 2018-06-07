// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { ITerminalServiceFactory } from '../common/terminal/types';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { TERMINAL_CREATE } from '../telemetry/constants';

export class TerminalProvider implements Disposable {
    private disposables: Disposable[] = [];
    constructor(private serviceContainer: IServiceContainer) {
        this.registerCommands();
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private registerCommands() {
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposable = commandManager.registerCommand(Commands.Create_Terminal, this.onCreateTerminal, this);

        this.disposables.push(disposable);
    }
    @captureTelemetry(TERMINAL_CREATE, { triggeredBy: 'commandpalette' })
    private async onCreateTerminal() {
        const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
        const activeResource = this.getActiveResource();
        await terminalService.createTerminalService(activeResource, 'Python').show(false);
    }
    private getActiveResource(): Uri | undefined {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        if (documentManager.activeTextEditor && !documentManager.activeTextEditor.document.isUntitled) {
            return documentManager.activeTextEditor.document.uri;
        }
        const workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        return Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0 ? workspace.workspaceFolders[0].uri : undefined;
    }
}
