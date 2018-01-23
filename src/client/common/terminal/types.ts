
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Terminal } from 'vscode';
export const ITerminalService = Symbol('ITerminalService');

export enum TerminalShellType {
    powershell = 1,
    commandPrompt = 2,
    bash = 3,
    fish = 4,
    other = 5
}

export interface ITerminalService {
    readonly onDidCloseTerminal: Event<void>;
    sendCommand(command: string, args: string[]): Promise<void>;
    sendText(text: string): Promise<void>;
}

export const ITerminalServiceFactory = Symbol('ITerminalServiceFactory');

export interface ITerminalServiceFactory {
    /**
     * Gets a terminal service with a specific title.
     * If one exists, its returned else a new one is created.
     * @param {string} title
     * @returns {ITerminalService}
     * @memberof ITerminalServiceFactory
     */
    getTerminalService(title?: string): ITerminalService;
}

export const ITerminalHelper = Symbol('ITerminalHelper');

export interface ITerminalHelper {
    createTerminal(title?: string): Terminal;
    identifyTerminalShell(shellPath: string): TerminalShellType;
    getTerminalShellPath(): string;
    buildCommandForTerminal(terminalShellType: TerminalShellType, command: string, args: string[]): string;
}
