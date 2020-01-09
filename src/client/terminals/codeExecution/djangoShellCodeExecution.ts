// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { PythonExecutionInfo } from '../../common/process/types';
import { ITerminalServiceFactory } from '../../common/terminal/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { DjangoContextInitializer } from './djangoContext';
import { TerminalCodeExecutionProvider } from './terminalCodeExecution';

@injectable()
export class DjangoShellCodeExecutionProvider extends TerminalCodeExecutionProvider {
    constructor(
        @inject(ITerminalServiceFactory) terminalServiceFactory: ITerminalServiceFactory,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IPlatformService) platformService: IPlatformService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[]
    ) {
        super(terminalServiceFactory, configurationService, workspace, disposableRegistry, platformService);
        this.terminalTitle = 'Django Shell';
        disposableRegistry.push(new DjangoContextInitializer(documentManager, workspace, fileSystem, commandManager));
    }

    public async getExecutableInfo(resource?: Uri, args: string[] = []): Promise<PythonExecutionInfo> {
        const { command, args: executableArgs } = await super.getExecutableInfo(resource, args);

        const workspaceUri = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const defaultWorkspace = Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0 ? this.workspace.workspaceFolders[0].uri.fsPath : '';
        const workspaceRoot = workspaceUri ? workspaceUri.uri.fsPath : defaultWorkspace;
        const managePyPath = workspaceRoot.length === 0 ? 'manage.py' : path.join(workspaceRoot, 'manage.py');

        executableArgs.push(managePyPath.fileToCommandArgument());
        executableArgs.push('shell');
        return { command, args: executableArgs };
    }

    public async getExecuteFileArgs(resource?: Uri, executeArgs: string[] = []): Promise<PythonExecutionInfo> {
        // We need the executable info but not the 'manage.py shell' args
        const { command, args } = await super.getExecutableInfo(resource);
        return { command, args: args.concat(executeArgs) };
    }
}
