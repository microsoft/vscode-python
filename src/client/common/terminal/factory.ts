// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { IFileSystem } from '../platform/types';
import { isUri } from '../utils/misc';
import { TerminalService } from './service';
import { SynchronousTerminalService } from './syncTerminalService';
import { ITerminalService, ITerminalServiceFactory, TerminalCreationOptions } from './types';

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
    public getTerminalService(options?: TerminalCreationOptions): ITerminalService;
    public getTerminalService(resource?: Uri, title?: string): ITerminalService;
    public getTerminalService(arg1?: Uri | TerminalCreationOptions, arg2?: string): ITerminalService {
        const resource = isUri(arg1) ? arg1 : undefined;
        const title = isUri(arg1) ? undefined : arg1?.title || arg2;
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        const interpreter = isUri(arg1) ? undefined : arg1?.interpreter;
        const hidden = isUri(arg1) ? false : arg1?.hidden === true;

        const id = this.getTerminalId(terminalTitle, resource, interpreter);
        if (!this.terminalServices.has(id)) {
            const terminalService = new TerminalService(this.serviceContainer, resource, terminalTitle, interpreter, hidden);
            this.terminalServices.set(id, terminalService);
        }

        // Decorate terminal service with the synchronous service.
        return new SynchronousTerminalService(this.fs, this.interpreterService, this.terminalServices.get(id)!, interpreter);
    }
    public createTerminalService(resource?: Uri, title?: string): ITerminalService {
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        return new TerminalService(this.serviceContainer, resource, terminalTitle);
    }
    private getTerminalId(title: string, resource?: Uri, interpreter?: PythonInterpreter): string {
        if (!resource && !interpreter) {
            return title;
        }
        const workspaceFolder = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService).getWorkspaceFolder(resource!);
        return workspaceFolder ? `${title}:${workspaceFolder.uri.fsPath}:${interpreter?.path}` : title;
    }
}
