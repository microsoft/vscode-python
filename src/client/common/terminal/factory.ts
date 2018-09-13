// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { TerminalService } from './service';
import { ITerminalService, ITerminalServiceFactory } from './types';

@injectable()
export class TerminalServiceFactory implements ITerminalServiceFactory {
    private terminalServices: Map<string, ITerminalService>;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {

        this.terminalServices = new Map<string, ITerminalService>();
    }
    public getTerminalService(resource?: Uri, title?: string): ITerminalService {

        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        const id = this.getTerminalId(terminalTitle, resource);
        if (!this.terminalServices.has(id)) {
            const terminalService = new TerminalService(this.serviceContainer, resource, terminalTitle);
            this.terminalServices.set(id, terminalService);
        }

        return this.terminalServices.get(id)!;
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
