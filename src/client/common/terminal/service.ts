// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Terminal, Uri, window, workspace } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IPlatformService } from '../platform/types';
import { IDisposableRegistry } from '../types';
import { ITerminalService, TerminalShellType } from './types';

const IS_BASH = /(bash.exe$|wsl.exe$|bash$|zsh$)/i;
const IS_COMMAND = /cmd.exe$/i;
const IS_POWERSHELL = /(powershell.exe$|pwsh$|powershell$)/i;
const IS_FISH = /(fish$)/i;

@injectable()
export class TerminalService implements ITerminalService {
    private terminal?: Terminal;
    private readonly detectableShells: Map<TerminalShellType, RegExp>;
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IPlatformService) private platformService: IPlatformService,
        private title: string = 'Python') {

        this.detectableShells = new Map<TerminalShellType, RegExp>();
        this.detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(TerminalShellType.fish, IS_FISH);
    }
    public async sendCommand(command: string, args: string[]): Promise<void> {
        const text = this.buildCommandForTerminal(command, args);
        const term = await this.getTerminal();
        term.show();
        term.sendText(text, true);
    }
    public async sendText(text: string): Promise<void> {
        const term = await this.getTerminal();
        term.show();
        term.sendText(text);
    }
    public getShellType(resource?: Uri): TerminalShellType {
        const shellPath = this.getTerminalShellPath(resource);
        if (!shellPath || shellPath.length === 0) {
            return TerminalShellType.other;
        }
        return Array.from(this.detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other && this.detectableShells.get(shellToDetect)!.test(shellPath)) {
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);
    }
    private getTerminalShellPath(resource?: Uri): string {
        const shellConfig = workspace.getConfiguration('terminal.integrated.shell', resource);
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
    private async getTerminal() {
        if (this.terminal) {
            return this.terminal!;
        }
        this.terminal = window.createTerminal(this.title);
        this.terminal!.show();

        // Sometimes the terminal takes some time to start up before it can start accepting input.
        await new Promise(resolve => setTimeout(resolve, 1000));

        const handler = window.onDidCloseTerminal((term) => {
            if (term === this.terminal) {
                this.terminal = undefined;
            }
        });

        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        disposables.push(this.terminal!);
        disposables.push(handler);

        return this.terminal;
    }

    private buildCommandForTerminal(command: string, args: string[]) {
        const executable = command.indexOf(' ') ? `"${command}"` : command;
        const isPowershell = this.getShellType() === TerminalShellType.powershell;
        const commandPrefix = isPowershell ? '& ' : '';
        return `${commandPrefix}${executable} ${args.join(' ')}`.trim();
    }
}
