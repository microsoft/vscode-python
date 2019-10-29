// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { ITerminalServiceFactory } from '../../common/terminal/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { ICondaService } from '../../interpreter/contracts';
import { DjangoContextInitializer } from './djangoContext';
import { TerminalCodeExecutionProvider } from './terminalCodeExecution';

@injectable()
export class DjangoShellCodeExecutionProvider extends TerminalCodeExecutionProvider {
    constructor(@inject(ITerminalServiceFactory) terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(ICondaService) condaService: ICondaService,
        @inject(IPlatformService) platformService: IPlatformService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[]
    ) {
        super(terminalServiceFactory, configurationService, workspace, disposableRegistry, condaService, platformService);
        this.terminalTitle = 'Django Shell';
        disposableRegistry.push(new DjangoContextInitializer(documentManager, workspace, fileSystem, commandManager));
    }

    public async getExecuteFileArgs(resource?: Uri, replArgs: string[] = []): Promise<{ command: string; args: string[] }> {
        const { command } = await this.getExecutableInfo(resource);
        const pythonSettings = this.configurationService.getSettings(resource);
        const args = pythonSettings.terminal.launchArgs.slice().concat(replArgs);

        return { command, args };
    }

    public async getExecutableInfo(resource?: Uri): Promise<{ command: string; args: string[] }> {
        const { command, args } = await super.getExecutableInfo(resource);

        const workspaceUri = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const defaultWorkspace = Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0 ? this.workspace.workspaceFolders[0].uri.fsPath : '';
        const workspaceRoot = workspaceUri ? workspaceUri.uri.fsPath : defaultWorkspace;
        const managePyPath = workspaceRoot.length === 0 ? 'manage.py' : path.join(workspaceRoot, 'manage.py');

        args.push(managePyPath.fileToCommandArgument());
        args.push('shell');
        return { command, args };
    }
}
