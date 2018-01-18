// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Uri } from 'vscode';
import { ITerminalManager } from '../application/types';
import { IDisposableRegistry } from '../types';
import { TerminalService } from './service';
import { ITerminalHelper, ITerminalService, ITerminalServiceFactory } from './types';

@injectable()
export class TerminalServiceFactory implements ITerminalServiceFactory {
    private terminalServices: Map<string, ITerminalService>;

    constructor( @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
        @inject(ITerminalManager) private terminalManager: ITerminalManager,
        @inject(ITerminalHelper) private terminalHelper: ITerminalHelper) {

        this.terminalServices = new Map<string, ITerminalService>();
    }
    public getTerminalService(resource?: Uri, title?: string): ITerminalService {
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        if (!this.terminalServices.has(terminalTitle)) {
            const terminalService = new TerminalService(this.terminalHelper, this.terminalManager, this.disposableRegistry, resource, terminalTitle);
            this.terminalServices.set(terminalTitle, terminalService);
        }
        return this.terminalServices.get(terminalTitle)!;
    }
}
