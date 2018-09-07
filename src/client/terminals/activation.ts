// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Terminal } from 'vscode';
import { ITerminalManager } from '../common/application/types';
import { ITerminalHelper } from '../common/terminal/types';
import { IDisposableRegistry } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { ITerminalAutoActivation } from './types';

@injectable()
export class TerminalAutoActivation implements ITerminalAutoActivation {
    private readonly helper: ITerminalHelper;
    constructor(@inject(IServiceContainer) private container: IServiceContainer) {
        this.helper = container.get<ITerminalHelper>(ITerminalHelper);
    }
    public register() {
        const manager = this.container.get<ITerminalManager>(ITerminalManager);
        const disposables = this.container.get<Disposable[]>(IDisposableRegistry);
        const disposable = manager.onDidOpenTerminal(this.activateTerminal, this);
        disposables.push(disposable);
    }
    private activateTerminal(terminal: Terminal): Promise<void> {
        return this.helper.activateEnvironmentInTerminal(terminal);
    }
}
