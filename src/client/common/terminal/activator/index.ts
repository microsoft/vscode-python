// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject } from 'inversify';
import { Terminal } from 'vscode';
import { ITerminalActivationHandler, ITerminalActivator, ITerminalHelper, TerminalActivationOptions } from '../types';
import { BaseTerminalActivator } from './base';

@injectable()
export class TerminalActivator implements ITerminalActivator {
    protected baseActivator!: ITerminalActivator;
    constructor(
        @inject(ITerminalHelper) readonly helper: ITerminalHelper,
        @multiInject(ITerminalActivationHandler) private readonly handlers: ITerminalActivationHandler[]
    ) {
        this.initialize();
    }
    public async activateEnvironmentInTerminal(
        terminal: Terminal,
        options?: TerminalActivationOptions
    ): Promise<boolean> {
        const activated = await this.baseActivator.activateEnvironmentInTerminal(terminal, options);
        this.handlers.forEach((handler) =>
            handler
                .handleActivation(terminal, options?.resource, options?.preserveFocus === true, activated)
                .ignoreErrors()
        );
        return activated;
    }
    protected initialize() {
        this.baseActivator = new BaseTerminalActivator(this.helper);
    }
}
