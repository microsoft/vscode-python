// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, Terminal, Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { ITerminalManager, IWorkspaceService } from '../application/types';
import { IPlatformService } from '../platform/types';
import { IDisposableRegistry } from '../types';
import { ITerminalHelper, ITerminalService, TerminalShellType } from './types';

const IS_BASH = /(bash.exe$|wsl.exe$|bash$|zsh$)/i;
const IS_COMMAND = /cmd.exe$/i;
const IS_POWERSHELL = /(powershell.exe$|pwsh$|powershell$)/i;
const IS_FISH = /(fish$)/i;

@injectable()
export class TerminalService implements ITerminalService, Disposable {
    private terminal?: Terminal;
    private terminalShellType: TerminalShellType;
    private terminalClosed = new EventEmitter<void>();
    private readonly detectableShells: Map<TerminalShellType, RegExp>;
    private terminalManager: ITerminalManager;
    private terminalHelper: ITerminalHelper;
    public get onDidCloseTerminal(): Event<void> {
        return this.terminalClosed.event;
    }
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        private _resource?: Uri,
        private title: string = 'Python') {

        this.detectableShells = new Map<TerminalShellType, RegExp>();
        this.detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(TerminalShellType.fish, IS_FISH);

        const disposableRegistry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        disposableRegistry.push(this);
        this.terminalManager = this.serviceContainer.get<ITerminalManager>(ITerminalManager);
        this.terminalManager.onDidCloseTerminal(this.terminalCloseHandler, this, disposableRegistry);
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
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
        const workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const shellConfig = workspace.getConfiguration('terminal.integrated.shell');

        const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
        let osSection = '';
        if (platformService.isWindows) {
            osSection = 'windows';
        } else if (platformService.isMac) {
            osSection = 'osx';
        } else if (platformService.isLinux) {
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
