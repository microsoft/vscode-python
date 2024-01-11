// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Event, EventEmitter, Terminal, TerminalOptions, window } from 'vscode';
import { traceLog } from '../../logging';
import { ITerminalManager } from './types';

@injectable()
export class TerminalManager implements ITerminalManager {
    private readonly didOpenTerminal = new EventEmitter<Terminal>();
    constructor() {
        window.onDidOpenTerminal((terminal) => {
            this.didOpenTerminal.fire(monkeyPatchTerminal(terminal));
        });
    }
    public get onDidCloseTerminal(): Event<Terminal> {
        return window.onDidCloseTerminal;
    }
    public get onDidOpenTerminal(): Event<Terminal> {
        return this.didOpenTerminal.event;
    }
    public createTerminal(options: TerminalOptions): Terminal {
        return monkeyPatchTerminal(window.createTerminal(options));
    }
}

/**
 * Monkeypatch the terminal to log commands sent.
 */
function monkeyPatchTerminal(terminal: Terminal) {
    if (!(terminal as any).isPatched) {
        const oldSendText = terminal.sendText.bind(terminal);
        terminal.sendText = (text: string, addNewLine: boolean = true) => {
            traceLog(`Send text to terminal: ${text}`);
            return oldSendText(text, addNewLine);
        };
        (terminal as any).isPatched = true;
    }
    return terminal;
}
