// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService } from '../../common/configuration/types';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { ITerminalServiceFactory } from '../../common/terminal/types';
import { IDisposableRegistry } from '../../common/types';
import { ICodeExecutionService } from '../../terminals/types';
import { DjangoContextInitializer } from './djangoContext';

@injectable()
export class DjangoShellCodeExecutionProvider implements ICodeExecutionService {
    constructor( @inject(ITerminalServiceFactory) private terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) private configurationService: IConfigurationService,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[]) {

        disposableRegistry.push(new DjangoContextInitializer(documentManager, workspace, fileSystem, commandManager));
    }
    public async executeFile(file: Uri) {
        const terminalServivce = this.terminalServiceFactory.getTerminalService();
        const pythonSettings = this.configurationService.getSettings(file);

        if (pythonSettings.terminal && pythonSettings.terminal.executeInFileDir) {
            const fileDirPath = path.dirname(file.fsPath);
            const wkspace = this.workspace.getWorkspaceFolder(file);
            if (wkspace && fileDirPath !== wkspace.uri.fsPath && fileDirPath.length > 0) {
                terminalServivce.sendText(`cd "${fileDirPath}"`);
            }
        }

        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const filePath = file.fsPath.indexOf(' ') > 0 ? `"${file.fsPath}"` : file.fsPath;

        const launchArgs = pythonSettings.terminal.launchArgs;

        terminalServivce.sendCommand(command, launchArgs.concat(filePath));
    }

    public async execute(code: string, resource?: Uri): Promise<void> {
        if (!code || code.trim().length === 0) {
            return;
        }

        const terminalServivce = this.terminalServiceFactory.getTerminalService('Django Shell');
        const pythonSettings = this.configurationService.getSettings(resource);

        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const launchArgs = pythonSettings.terminal.launchArgs;

        const workspaceUri = resource ? vscode.workspace.getWorkspaceFolder(resource) : undefined;
        const defaultWorkspace = Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
        const workspaceRoot = workspaceUri ? workspaceUri.uri.fsPath : defaultWorkspace;
        const djangoShellCmd = `"${path.join(workspaceRoot, 'manage.py')}" shell`;

        terminalServivce.sendCommand(command, launchArgs.concat([djangoShellCmd]));

        // Give python repl time to start before we start sending text.
        await new Promise(resolve => setTimeout(resolve, 1000));

        terminalServivce.sendText(code);
    }
}
