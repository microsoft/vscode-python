// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { env, Terminal } from 'vscode';
import { createDeferred, sleep } from '../../utils/async';
import { ITerminalActivator, ITerminalHelper, TerminalActivationOptions, TerminalShellType } from '../types';

export class BaseTerminalActivator implements ITerminalActivator {
    private readonly activatedTerminals: Map<Terminal, Promise<boolean>> = new Map<Terminal, Promise<boolean>>();
    constructor(private readonly helper: ITerminalHelper) {}
    public async activateEnvironmentInTerminal(
        terminal: Terminal,
        options?: TerminalActivationOptions,
    ): Promise<boolean> {
        if (this.activatedTerminals.has(terminal)) {
            return this.activatedTerminals.get(terminal)!;
        }
        const deferred = createDeferred<boolean>();
        this.activatedTerminals.set(terminal, deferred.promise);
        const terminalShellType = this.helper.identifyTerminalShell(terminal);

        const activationCommands = await this.helper.getEnvironmentActivationCommands(
            terminalShellType,
            options?.resource,
            options?.interpreter,
        );
        console.log('Got the activation commands', JSON.stringify(activationCommands));
        let activated = false;
        if (activationCommands) {
            for (const command of activationCommands) {
                terminal.show(options?.preserveFocus);
                if ('shellPath' in terminal.creationOptions && terminal.creationOptions.shellPath) {
                    console.log('Shell path is', terminal.creationOptions.shellPath);
                }
                console.log(`Shell path returned by vscode API`, env.shell);
                console.log(`Sending ${command} to terminal`, terminal.creationOptions.name);
                terminal.sendText(command);
                await this.waitForCommandToProcess(terminalShellType);
                activated = true;
            }
        }
        console.log('Activation complete', activated);
        deferred.resolve(activated);
        console.timeEnd('Time taken to send command');
        return activated;
    }
    protected async waitForCommandToProcess(_shell: TerminalShellType) {
        // Give the command some time to complete.
        // Its been observed that sending commands too early will strip some text off in VS Code Terminal.
        await sleep(500);
    }
}
