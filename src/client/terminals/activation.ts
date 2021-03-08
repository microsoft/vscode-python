// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import { IActiveResourceService, ITerminalManager } from '../common/application/types';
import { ITerminalActivator } from '../common/terminal/types';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { ITerminalAutoActivation } from './types';

@injectable()
export class TerminalAutoActivation implements ITerminalAutoActivation {
    private handler?: IDisposable;

    constructor(
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(ITerminalActivator) private readonly activator: ITerminalActivator,
        @inject(IActiveResourceService) private readonly activeResourceService: IActiveResourceService,
    ) {
        disposableRegistry.push(this);
    }

    public dispose(): void {
        if (this.handler) {
            this.handler.dispose();
            this.handler = undefined;
        }
    }

    public register(): void {
        if (this.handler) {
            return;
        }
        this.handler = this.terminalManager.onDidOpenTerminal(this.activateTerminal, this);
    }

    private async activateTerminal(terminal: Terminal): Promise<void> {
        if ('hideFromUser' in terminal.creationOptions && terminal.creationOptions.hideFromUser) {
            return;
        }
        // If we have just one workspace, then pass that as the resource.
        // Until upstream VSC issue is resolved https://github.com/Microsoft/vscode/issues/63052.
        await this.activator.activateEnvironmentInTerminal(terminal, {
            resource: this.activeResourceService.getActiveResource(),
        });
    }
}
