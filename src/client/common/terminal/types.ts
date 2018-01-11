// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const ITerminalService = Symbol('ITerminalService');

export enum TerminalShellType {
    powershell = 1,
    commandPrompt = 2,
    bash = 3,
    fish = 4,
    other = 5
}

export interface ITerminalService {
    sendCommand(command: string, args: string[]): Promise<void>;
    sendText(text: string): Promise<void>;
    getShellType(): TerminalShellType;
}

export const ITerminalServiceFactory = Symbol('ITerminalServiceFactory');

export interface ITerminalServiceFactory {
    /**
     * Gets a terminal service with a specific title.
     * If one exists, its returned else a new one is created.
     * @param {string} name
     * @returns {ITerminalService}
     * @memberof ITerminalServiceFactory
     */
    getTerminalService(title?: string): ITerminalService;
}
