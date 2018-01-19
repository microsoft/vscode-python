// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Terminal, Uri, workspace } from 'vscode';
import { IInterpreterService } from '../../interpreter/contracts';
import { ITerminalManager } from '../application/types';
import { IPlatformService } from '../platform/types';
import { ITerminalHelper, TerminalShellType } from './types';

// Types of shells can be found here:
// 1. https://wiki.ubuntu.com/ChangingShells
const IS_BASH = /(bash.exe$|wsl.exe$|bash$|zsh$|ksh$)/i;
const IS_COMMAND = /cmd.exe$/i;
const IS_POWERSHELL = /(powershell.exe$|pwsh$|powershell$)/i;
const IS_FISH = /(fish$)/i;
const IS_CSHELL = /(tcsh$|csh$)/i;

@injectable()
export class TerminalHelper implements ITerminalHelper {
    private readonly detectableShells: Map<TerminalShellType, RegExp>;
    constructor( @inject(IPlatformService) private platformService: IPlatformService,
        @inject(ITerminalManager) private terminalManager: ITerminalManager,
        @inject(IInterpreterService) private interpreterService: IInterpreterService) {
        this.detectableShells = new Map<TerminalShellType, RegExp>();
        this.detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(TerminalShellType.fish, IS_FISH);
        this.detectableShells.set(TerminalShellType.cshell, IS_CSHELL);
    }
    public createTerminal(title?: string): Terminal {
        return this.terminalManager.createTerminal({ name: title });
    }
    public identifyTerminalShell(shellPath: string): TerminalShellType {
        return Array.from(this.detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other && this.detectableShells.get(shellToDetect)!.test(shellPath)) {
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);
    }
    public getTerminalShellPath(): string {
        const shellConfig = workspace.getConfiguration('terminal.integrated.shell');
        let osSection = '';
        if (this.platformService.isWindows) {
            osSection = 'windows';
        } else if (this.platformService.isMac) {
            osSection = 'osx';
        } else if (this.platformService.isLinux) {
            osSection = 'linux';
        }
        if (osSection.length === 0) {
            return '';
        }
        return shellConfig.get<string>(osSection)!;
    }
    public buildCommandForTerminal(terminalShellType: TerminalShellType, command: string, args: string[]) {
        const executable = command.indexOf(' ') > 0 ? `"${command}"` : command;
        const isPowershell = terminalShellType === TerminalShellType.powershell;
        const commandPrefix = isPowershell ? '& ' : '';
        return `${commandPrefix}${executable} ${args.join(' ')}`.trim();
    }
    public async getActivationScript(terminalShellType: TerminalShellType, resource?: Uri): Promise<string | undefined> {
        // const interperterInfo = await this.interpreterService.getActiveInterpreter(resource);
        // interperterInfo.type
        return;
    }
}
