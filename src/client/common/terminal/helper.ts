// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Terminal, Uri } from 'vscode';
import { IInterpreterService, InterpreterType } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ITerminalManager, IWorkspaceService } from '../application/types';
import { IPlatformService } from '../platform/types';
import { Conda } from './environmentActivationProviders/conda';
import { ITerminalActivationCommandProvider, ITerminalHelper, TerminalShellType } from './types';

// Types of shells can be found here:
// 1. https://wiki.ubuntu.com/ChangingShells
const IS_BASH = /(bash.exe$|wsl.exe$|bash$|zsh$|ksh$)/i;
const IS_COMMAND = /cmd.exe$/i;
const IS_POWERSHELL = /(powershell.exe$|pwsh$|powershell$)/i;
const IS_FISH = /(fish$)/i;
const IS_CSHELL = /(csh$)/i;

@injectable()
export class TerminalHelper implements ITerminalHelper {
    private readonly detectableShells: Map<TerminalShellType, RegExp>;
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer) {

        this.detectableShells = new Map<TerminalShellType, RegExp>();
        this.detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(TerminalShellType.fish, IS_FISH);
        this.detectableShells.set(TerminalShellType.cshell, IS_CSHELL);
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
        const executable = command.indexOf(' ') > 0 ? `"${command}"` : command;
        const isPowershell = terminalShellType === TerminalShellType.powershell;
        const commandPrefix = isPowershell ? '& ' : '';
        return `${commandPrefix}${executable} ${args.join(' ')}`.trim();
    }
    public async getEnvironmentActivationCommand(terminalShellType: TerminalShellType, resource?: Uri): Promise<string | undefined> {
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const interperterInfo = await interpreterService.getActiveInterpreter(resource);
        if (!interperterInfo) {
            return;
        }
        // Conda activation scripts are easy and special.
        if (interperterInfo.type === InterpreterType.Conda) {
            return await new Conda(this.serviceContainer).getActivationCommand(interperterInfo, terminalShellType);
        }

        // Search from the list of providers.
        const providers = this.serviceContainer.getAll<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider);
        const supportedProviders = providers.filter(provider => provider.isShellSupported(terminalShellType));

        for (const provider of supportedProviders) {
            const activationCommand = await provider.getActivationCommand(interperterInfo, terminalShellType);
            if (typeof activationCommand === 'string' && activationCommand.length > 0) {
                return activationCommand;
            }
        }
    }
}
