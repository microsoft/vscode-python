
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Terminal, Uri } from 'vscode';
import { PythonInterpreter } from '../../interpreter/contracts';

export enum TerminalShellType {
    powershell = 1,
    commandPrompt = 2,
    bash = 3,
    fish = 4,
    cshell = 5,
    other = 6
}

export interface ITerminalService {
    readonly onDidCloseTerminal: Event<void>;
    sendCommand(command: string, args: string[]): Promise<void>;
    sendText(text: string): Promise<void>;
    show(): void;
}

export const ITerminalServiceFactory = Symbol('ITerminalServiceFactory');

export interface ITerminalServiceFactory {
    /**
     * Gets a terminal service with a specific title.
     * If one exists, its returned else a new one is created.
     * @param {Uri} resource
     * @param {string} title
     * @returns {ITerminalService}
     * @memberof ITerminalServiceFactory
     */
    getTerminalService(resource?: Uri, title?: string): ITerminalService;
}

export const ITerminalHelper = Symbol('ITerminalHelper');

export interface ITerminalHelper {
    createTerminal(title?: string): Terminal;
    identifyTerminalShell(shellPath: string): TerminalShellType;
    getTerminalShellPath(): string;
    buildCommandForTerminal(terminalShellType: TerminalShellType, command: string, args: string[]): string;
    getEnvironmentActivationCommands(terminalShellType: TerminalShellType, resource?: Uri): Promise<string[] | undefined>;
}

export const ITerminalActivationCommandProvider = Symbol('ITerminalActivationCommandProvider');

export interface ITerminalActivationCommandProvider {
    isShellSupported(targetShell: TerminalShellType): boolean;
    getActivationCommands(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string[] | undefined>;
}
