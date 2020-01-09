// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { IFileSystem } from '../platform/types';
import { TerminalService } from './service';
import { SynchronousTerminalService } from './syncTerminalService';
import { ITerminalService, ITerminalServiceFactory } from './types';

@injectable()
export class TerminalServiceFactory implements ITerminalServiceFactory {
    private terminalServices: Map<string, TerminalService>;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IFileSystem) private fs: IFileSystem,
        @inject(IInterpreterService) private interpreterService: IInterpreterService
    ) {
        this.terminalServices = new Map<string, TerminalService>();
    }
    public getTerminalService(resource?: Uri, title?: string): ITerminalService {
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        const id = this.getTerminalId(terminalTitle, resource);
        if (!this.terminalServices.has(id)) {
            const terminalService = new TerminalService(this.serviceContainer, resource, terminalTitle);
            this.terminalServices.set(id, terminalService);
        }

        // Decorate terminal service with the synchronous service.
        return new SynchronousTerminalService(this.fs, this.interpreterService, this.terminalServices.get(id)!);
    }
    public createTerminalService(resource?: Uri, title?: string): ITerminalService {
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        return new TerminalService(this.serviceContainer, resource, terminalTitle);
    }
    private getTerminalId(title: string, resource?: Uri): string {
        if (!resource) {
            return title;
        }
        const workspaceFolder = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService).getWorkspaceFolder(resource!);
        return workspaceFolder ? `${title}:${workspaceFolder.uri.fsPath}` : title;
    }
}
