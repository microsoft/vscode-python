// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Terminal, Uri } from 'vscode';
import { ICondaService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ITerminalManager, IWorkspaceService } from '../application/types';
import '../extensions';
import { IPlatformService } from '../platform/types';
import { IConfigurationService } from '../types';
import { CondaActivationCommandProvider } from './environmentActivationProviders/condaActivationProvider';
import { ITerminalActivationCommandProvider, ITerminalHelper, TerminalShellType } from './types';

// Types of shells can be found here:
// 1. https://wiki.ubuntu.com/ChangingShells
const IS_GITBASH = /(gitbash.exe$)/i;
const IS_BASH = /(bash.exe$|bash$)/i;
const IS_WSL = /(wsl.exe$)/i;
const IS_ZSH = /(zsh$)/i;
const IS_KSH = /(ksh$)/i;
const IS_COMMAND = /cmd.exe$/i;
const IS_POWERSHELL = /(powershell.exe$|powershell$)/i;
const IS_POWERSHELL_CORE = /(pwsh.exe$|pwsh$)/i;
const IS_FISH = /(fish$)/i;
const IS_CSHELL = /(csh$)/i;
const IS_TCSHELL = /(tcsh$)/i;

@injectable()
export class TerminalHelper implements ITerminalHelper {
    private readonly detectableShells: Map<TerminalShellType, RegExp>;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.detectableShells = new Map<TerminalShellType, RegExp>();
        this.detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(TerminalShellType.gitbash, IS_GITBASH);
        this.detectableShells.set(TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(TerminalShellType.wsl, IS_WSL);
        this.detectableShells.set(TerminalShellType.zsh, IS_ZSH);
        this.detectableShells.set(TerminalShellType.ksh, IS_KSH);
        this.detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(TerminalShellType.fish, IS_FISH);
        this.detectableShells.set(TerminalShellType.tcshell, IS_TCSHELL);
        this.detectableShells.set(TerminalShellType.cshell, IS_CSHELL);
        this.detectableShells.set(TerminalShellType.powershellCore, IS_POWERSHELL_CORE);
    }
    public createTerminal(title?: string): Terminal {
        const terminalManager = this.serviceContainer.get<ITerminalManager>(ITerminalManager);
        return terminalManager.createTerminal({ name: title });
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
        const isPowershell = terminalShellType === TerminalShellType.powershell || terminalShellType === TerminalShellType.powershellCore;
        const commandPrefix = isPowershell ? '& ' : '';
        return `${commandPrefix}${command.fileToCommandArgument()} ${args.join(' ')}`.trim();
    }
    public async getEnvironmentActivationCommands(terminalShellType: TerminalShellType, resource?: Uri): Promise<string[] | undefined> {
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource);
        const activateEnvironment = settings.terminal.activateEnvironment;
        if (!activateEnvironment) {
            return;
        }

        // If we have a conda environment, then use that.
        const isCondaEnvironment = await this.serviceContainer.get<ICondaService>(ICondaService).isCondaEnvironment(settings.pythonPath);
        if (isCondaEnvironment) {
            const condaActivationProvider = new CondaActivationCommandProvider(this.serviceContainer);
            const activationCommands = await condaActivationProvider.getActivationCommands(resource, terminalShellType);
            if (Array.isArray(activationCommands)) {
                return activationCommands;
            }
        }

        // Search from the list of providers.
        const providers = this.serviceContainer.getAll<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider);
        const supportedProviders = providers.filter(provider => provider.isShellSupported(terminalShellType));

        for (const provider of supportedProviders) {
            const activationCommands = await provider.getActivationCommands(resource, terminalShellType);
            if (Array.isArray(activationCommands)) {
                return activationCommands;
            }
        }
    }
}
