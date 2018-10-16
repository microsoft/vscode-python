// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Terminal, Uri } from 'vscode';
import { sleep } from '../../utils/async';
import { ITerminalActivator, ITerminalHelper, TerminalShellType } from '../types';

export class BaseTerminalActivator implements ITerminalActivator {
    private readonly activatedTerminals: Set<Terminal> = new Set<Terminal>();
    constructor(private readonly helper: ITerminalHelper) { }
    public async activateEnvironmentInTerminal(terminal: Terminal, resource: Uri | undefined, preserveFocus: boolean = true) {
        if (this.activatedTerminals.has(terminal)) {
            return false;
        }
        this.activatedTerminals.add(terminal);
        const shellPath = this.helper.getTerminalShellPath();
        const terminalShellType = !shellPath || shellPath.length === 0 ? TerminalShellType.other : this.helper.identifyTerminalShell(shellPath);

        const activationCommamnds = await this.helper.getEnvironmentActivationCommands(terminalShellType, resource);
        if (activationCommamnds) {
            for (const command of activationCommamnds!) {
                terminal.show(preserveFocus);
                terminal.sendText(command);
                await this.waitForCommandToProcess(terminalShellType);
            }
            return true;
        } else {
            return false;
        }
    }
    protected async waitForCommandToProcess(shell: TerminalShellType) {
        // Give the command some time to complete.
        // Its been observed that sending commands too early will strip some text off in VS Code Terminal.
        await sleep(500);
    }
}
