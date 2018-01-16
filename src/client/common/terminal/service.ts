// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, Terminal } from 'vscode';
import { ITerminalManager } from '../application/types';
import { IDisposableRegistry } from '../types';
import { ITerminalHelper, ITerminalService, TerminalShellType } from './types';

@injectable()
export class TerminalService implements ITerminalService, Disposable {
    private terminal?: Terminal;
    private terminalShellType: TerminalShellType;
    private terminalClosed = new EventEmitter<void>();
    public get onDidCloseTerminal(): Event<void> {
        return this.terminalClosed.event;
    }
    constructor( @inject(ITerminalHelper) private terminalHelper: ITerminalHelper,
        @inject(ITerminalManager) terminalManager: ITerminalManager,
        @inject(IDisposableRegistry) disposableRegistry: Disposable[],
        private title: string = 'Python') {

        disposableRegistry.push(this);
        terminalManager.onDidCloseTerminal(this.terminalCloseHandler, this, disposableRegistry);
    }
    public dispose() {
        if (this.terminal) {
            this.terminal.dispose();
        }
    }
    public async sendCommand(command: string, args: string[]): Promise<void> {
        await this.ensureTerminal();
        const text = this.terminalHelper.buildCommandForTerminal(this.terminalShellType, command, args);
        this.terminal!.show();
        this.terminal!.sendText(text, true);
    }
    public async sendText(text: string): Promise<void> {
        await this.ensureTerminal();
        this.terminal!.show();
        this.terminal!.sendText(text);
    }
    private async ensureTerminal(): Promise<void> {
        if (this.terminal) {
            return;
        }
        const shellPath = this.terminalHelper.getTerminalShellPath();
        this.terminalShellType = !shellPath || shellPath.length === 0 ? TerminalShellType.other : this.terminalHelper.identifyTerminalShell(shellPath);
        this.terminal = this.terminalHelper.createTerminal(this.title);
        this.terminal!.show();

        // Sometimes the terminal takes some time to start up before it can start accepting input.
        // tslint:disable-next-line:no-unnecessary-callback-wrapper
        await new Promise(resolve => setTimeout(() => resolve(), 1000));
    }
    private terminalCloseHandler(terminal: Terminal) {
        if (terminal === this.terminal) {
            this.terminalClosed.fire();
            this.terminal = undefined;
        }
    }
}
