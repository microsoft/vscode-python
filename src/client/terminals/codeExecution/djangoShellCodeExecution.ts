// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { ITerminalServiceFactory } from '../../common/terminal/types';
import { IConfigurationService } from '../../common/types';
import { IDisposableRegistry } from '../../common/types';
import { DjangoContextInitializer } from './djangoContext';
import { TerminalCodeExecutionProvider } from './terminalCodeExecution';

@injectable()
export class DjangoShellCodeExecutionProvider extends TerminalCodeExecutionProvider {
    constructor( @inject(ITerminalServiceFactory) terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IPlatformService) platformService: IPlatformService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[]) {

        super(terminalServiceFactory, configurationService, workspace, disposableRegistry, platformService);
        this.terminalTitle = 'Django Shell';
        disposableRegistry.push(new DjangoContextInitializer(documentManager, workspace, fileSystem, commandManager));
    }
    public getReplCommandArgs(resource?: Uri): { command: string, args: string[] } {
        const pythonSettings = this.configurationService.getSettings(resource);
        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const args = pythonSettings.terminal.launchArgs.slice();

        const workspaceUri = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const defaultWorkspace = Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0 ? this.workspace.workspaceFolders[0].uri.fsPath : '';
        const workspaceRoot = workspaceUri ? workspaceUri.uri.fsPath : defaultWorkspace;
        const managePyPath = workspaceRoot.length === 0 ? 'manage.py' : path.join(workspaceRoot, 'manage.py');
        const escapedManagePyPath = managePyPath.indexOf(' ') > 0 ? `"${managePyPath}"` : managePyPath;

        args.push(escapedManagePyPath);
        args.push('shell');
        return { command, args };
    }
}
