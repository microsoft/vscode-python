// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Terminal, Uri, window, workspace } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IDisposableRegistry, IsWindows } from '../types';
import { ITerminalService } from './types';

const IS_POWERSHELL = /powershell.exe$/i;

@injectable()
export class TerminalService implements ITerminalService {
    private terminal?: Terminal;
    private textPreviouslySentToTerminal: boolean = false;
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer) { }
    public async sendCommand(command: string, args: string[]): Promise<void> {
        const text = this.buildTerminalText(command, args);
        const term = await this.getTerminal();
        term.show(false);
        term.sendText(text, true);
        this.textPreviouslySentToTerminal = true;
    }

    private async getTerminal() {
        if (this.terminal) {
            return this.terminal!;
        }
        this.terminal = window.createTerminal('Python');
        this.terminal.show(false);

        // Sometimes the terminal takes some time to start up before it can start accepting input.
        // However if we have already sent text to the terminal, then no need to wait.
        if (!this.textPreviouslySentToTerminal) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const handler = window.onDidCloseTerminal((term) => {
            if (term === this.terminal) {
                this.terminal = undefined;
            }
        });

        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        disposables.push(this.terminal);
        disposables.push(handler);

        return this.terminal;
    }

    private buildTerminalText(command: string, args: string[]) {
        const executable = command.indexOf(' ') ? `"${command}"` : command;
        const commandPrefix = this.terminalIsPowershell() ? '& ' : '';
        return `${commandPrefix}${executable} ${args.join(' ')}`.trim();
    }

    private terminalIsPowershell(resource?: Uri) {
        const isWindows = this.serviceContainer.get<boolean>(IsWindows);
        if (!isWindows) {
            return false;
        }
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const terminalName = workspace.getConfiguration('terminal.integrated.shell', resource).get<string>('windows');
        return typeof terminalName === 'string' && IS_POWERSHELL.test(terminalName);
    }
}
