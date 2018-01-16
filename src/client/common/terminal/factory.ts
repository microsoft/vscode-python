// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable } from 'vscode';
import { ITerminalManager } from '../application/types';
import { IDisposableRegistry } from '../types';
import { TerminalService } from './service';
import { ITerminalHelper, ITerminalService, ITerminalServiceFactory } from './types';

@injectable()
export class TerminalServiceFactory implements ITerminalServiceFactory {
    private terminalServices: Map<string, ITerminalService>;

    constructor( @inject(ITerminalService) private defaultTerminalService: ITerminalService,
        @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
        @inject(ITerminalManager) private terminalManager: ITerminalManager,
        @inject(ITerminalHelper) private terminalHelper: ITerminalHelper) {

        this.terminalServices = new Map<string, ITerminalService>();
    }
    public getTerminalService(title?: string): ITerminalService {
        if (typeof title !== 'string' || title.trim().length === 0) {
            return this.defaultTerminalService;
        }
        if (!this.terminalServices.has(title)) {
            const terminalService = new TerminalService(this.terminalHelper, this.terminalManager, this.disposableRegistry, title);
            this.terminalServices.set(title, terminalService);
        }
        return this.terminalServices.get(title)!;
    }
}
