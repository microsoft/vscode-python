// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Event, Terminal, TerminalOptions, window } from 'vscode';
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
        return window.createTerminal(options);
    }
}
