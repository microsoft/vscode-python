// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, Event, Terminal, Uri } from 'vscode';
import { PythonInterpreter } from '../../interpreter/contracts';
import { IEventNamePropertyMapping } from '../../telemetry/index';
import { Resource } from '../types';

export enum TerminalActivationProviders {
    bashCShellFish = 'bashCShellFish',
    commandPromptAndPowerShell = 'commandPromptAndPowerShell',
    pyenv = 'pyenv',
    conda = 'conda',
    pipenv = 'pipenv'
}
export enum TerminalShellType {
    powershell = 'powershell',
    powershellCore = 'powershellCore',
    commandPrompt = 'commandPrompt',
    gitbash = 'gitbash',
    bash = 'bash',
    zsh = 'zsh',
    ksh = 'ksh',
    fish = 'fish',
    cshell = 'cshell',
    tcshell = 'tshell',
    wsl = 'wsl',
    xonsh = 'xonsh',
    other = 'other'
}

export interface ITerminalService {
    readonly onDidCloseTerminal: Event<void>;
    sendCommand(command: string, args: string[], cancel?: CancellationToken): Promise<void>;
    sendText(text: string): Promise<void>;
    show(preserveFocus?: boolean): Promise<void>;
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
    createTerminalService(resource?: Uri, title?: string): ITerminalService;
}

export const ITerminalHelper = Symbol('ITerminalHelper');

export interface ITerminalHelper {
    createTerminal(title?: string): Terminal;
    identifyTerminalShell(terminal?: Terminal): TerminalShellType;
    buildCommandForTerminal(terminalShellType: TerminalShellType, command: string, args: string[]): string;
    getEnvironmentActivationCommands(terminalShellType: TerminalShellType, resource?: Uri): Promise<string[] | undefined>;
    getEnvironmentActivationShellCommands(resource: Resource, shell: TerminalShellType, interpreter?: PythonInterpreter): Promise<string[] | undefined>;
}

export const ITerminalActivator = Symbol('ITerminalActivator');
export interface ITerminalActivator {
    activateEnvironmentInTerminal(terminal: Terminal, resource: Uri | undefined, preserveFocus?: boolean): Promise<boolean>;
}

export const ITerminalActivationCommandProvider = Symbol('ITerminalActivationCommandProvider');

export interface ITerminalActivationCommandProvider {
    isShellSupported(targetShell: TerminalShellType): boolean;
    getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined>;
    getActivationCommandsForInterpreter(pythonPath: string, targetShell: TerminalShellType): Promise<string[] | undefined>;
}

export const ITerminalActivationHandler = Symbol('ITerminalActivationHandler');
export interface ITerminalActivationHandler {
    handleActivation(terminal: Terminal, resource: Uri | undefined, preserveFocus: boolean, activated: boolean): Promise<void>;
}

export type ShellIdentificationTelemetry = IEventNamePropertyMapping['TERMINAL_SHELL_IDENTIFICATION'];

export const IShellDetector = Symbol('IShellDetector');
/**
 * Used to identify a shell.
 * Each implemenetion will provide a unique way of identifying the shell.
 *
 * @export
 * @interface IShellDetector
 */
export interface IShellDetector {
    /**
     * Classes with higher priorities will be used first when identifying the shell.
     *
     * @type {number}
     * @memberof IShellDetector
     */
    readonly priority: number;
    identify(telemetryProperties: ShellIdentificationTelemetry, terminal?: Terminal): TerminalShellType | undefined;
}
