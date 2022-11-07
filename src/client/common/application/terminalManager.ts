// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Event, Terminal, TerminalOptions, window } from 'vscode';
import { traceLog } from '../../logging';
import { ITerminalManager } from './types';

@injectable()
export class TerminalManager implements ITerminalManager {
    public get onDidCloseTerminal(): Event<Terminal> {
        return window.onDidCloseTerminal;
    }
    public get onDidOpenTerminal(): Event<Terminal> {
        return window.onDidOpenTerminal;
    }
    public createTerminal(options: TerminalOptions): Terminal {
        const terminal = window.createTerminal(options);
        // Monkeypatch the terminal to log commands sent.
        terminal.sendText = (text: string, addNewLine: boolean = true) => {
            traceLog(`Send text to terminal: ${text}`);
            return terminal.sendText(text, addNewLine);
        };
        return terminal;
    }
}
