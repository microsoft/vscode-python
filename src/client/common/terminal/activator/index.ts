// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject } from 'inversify';
import { Terminal, Uri } from 'vscode';
import { ITerminalActivationHandler, ITerminalActivator, ITerminalHelper } from '../types';
import { BaseTerminalActivator } from './base';

@injectable()
export class TerminalActivator implements ITerminalActivator {
    protected baseActivator!: ITerminalActivator;
    constructor(@inject(ITerminalHelper) readonly helper: ITerminalHelper, @multiInject(ITerminalActivationHandler) private readonly handlers: ITerminalActivationHandler[]) {
        this.initialize();
    }
    public async activateEnvironmentInTerminal(terminal: Terminal, resource: Uri | undefined, preserveFocus: boolean = true) {
        const activated = await this.baseActivator.activateEnvironmentInTerminal(terminal, resource, preserveFocus);
        this.handlers.forEach(handler => handler.handleActivation(terminal, resource, preserveFocus, activated).ignoreErrors());
        return activated;
    }
    protected initialize() {
        this.baseActivator = new BaseTerminalActivator(this.helper);
    }
}
