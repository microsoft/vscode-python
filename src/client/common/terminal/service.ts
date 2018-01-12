// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Terminal, window } from 'vscode';
import { IDisposableRegistry } from '../types';
import { ITerminalHelper, ITerminalService, TerminalShellType } from './types';

@injectable()
export class TerminalService implements ITerminalService, Disposable {
    private terminal?: Terminal;
    private terminalShellType: TerminalShellType;
    constructor( @inject(ITerminalHelper) private terminalHelper: ITerminalHelper,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[],
        private title: string = 'Python') {

        disposableRegistry.push(this);
        window.onDidCloseTerminal(this.terminalCloseHandler, this, disposableRegistry);
    }
    public dispose() {
        if (this.terminal) {
            this.terminal.dispose();
        }
    }
    public async sendCommand(command: string, args: string[]): Promise<void> {
        const term = await this.getTerminal();
        const text = this.terminalHelper.buildCommandForTerminal(this.terminalShellType, command, args);
        term.show();
        term.sendText(text, true);
    }
    public async sendText(text: string): Promise<void> {
        const term = await this.getTerminal();
        term.show();
        term.sendText(text);
    }
    private async getTerminal() {
        if (this.terminal) {
            return this.terminal!;
        }
        const shellPath = this.terminalHelper.getTerminalShellPath();
        this.terminalShellType = !shellPath || shellPath.length === 0 ? TerminalShellType.other : this.terminalHelper.identifyTerminalShell(shellPath);
        this.terminal = this.terminalHelper.createTerminal(this.title);
        this.terminal!.show();

        // Sometimes the terminal takes some time to start up before it can start accepting input.
        await new Promise(resolve => setTimeout(resolve, 1000));

        return this.terminal;
    }
    private terminalCloseHandler(terminal: Terminal) {
        if (terminal === this.terminal) {
            this.terminal = undefined;
        }
    }
}
