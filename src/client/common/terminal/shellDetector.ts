// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Terminal } from 'vscode';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IWorkspaceService } from '../application/types';
import '../extensions';
import { traceVerbose } from '../logger';
import { IPlatformService } from '../platform/types';
import { ICurrentProcess } from '../types';
import { OSType } from '../utils/platform';
import { TerminalShellType } from './types';

// Types of shells can be found here:
// 1. https://wiki.ubuntu.com/ChangingShells
const IS_GITBASH = /(gitbash.exe$)/i;
const IS_BASH = /(bash.exe$|bash$)/i;
const IS_WSL = /(wsl.exe$)/i;
const IS_ZSH = /(zsh$)/i;
const IS_KSH = /(ksh$)/i;
const IS_COMMAND = /(cmd.exe$|cmd$)/i;
const IS_POWERSHELL = /(powershell.exe$|powershell$)/i;
const IS_POWERSHELL_CORE = /(pwsh.exe$|pwsh$)/i;
const IS_FISH = /(fish$)/i;
const IS_CSHELL = /(csh$)/i;
const IS_TCSHELL = /(tcsh$)/i;
const IS_XONSH = /(xonsh$)/i;

const defaultOSShells = {
    [OSType.Linux]: TerminalShellType.bash,
    [OSType.OSX]: TerminalShellType.bash,
    [OSType.Windows]: TerminalShellType.commandPrompt,
    [OSType.Unknown]: undefined
};

type ShellIdentificationTelemetry = {
    failed: boolean;
    terminalProvided: boolean;
    shellIdentificationSource: 'terminalName' | 'settings' | 'environment' | 'default';
    hasCustomShell: undefined | boolean;
    hasShellInEnv: undefined | boolean;
};
const detectableShells = new Map<TerminalShellType, RegExp>();
detectableShells.set(TerminalShellType.powershell, IS_POWERSHELL);
detectableShells.set(TerminalShellType.gitbash, IS_GITBASH);
detectableShells.set(TerminalShellType.bash, IS_BASH);
detectableShells.set(TerminalShellType.wsl, IS_WSL);
detectableShells.set(TerminalShellType.zsh, IS_ZSH);
detectableShells.set(TerminalShellType.ksh, IS_KSH);
detectableShells.set(TerminalShellType.commandPrompt, IS_COMMAND);
detectableShells.set(TerminalShellType.fish, IS_FISH);
detectableShells.set(TerminalShellType.tcshell, IS_TCSHELL);
detectableShells.set(TerminalShellType.cshell, IS_CSHELL);
detectableShells.set(TerminalShellType.powershellCore, IS_POWERSHELL_CORE);
detectableShells.set(TerminalShellType.xonsh, IS_XONSH);

@injectable()
export class ShellDetector {
    constructor(@inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(ICurrentProcess) private readonly currentProcess: ICurrentProcess,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService
    ) { }
    /**
     * Logic is as follows:
     * 1. Try to identify the type of the shell based on the name of the terminal.
     * 2. Try to identify the type of the shell based on the usettigs in VSC.
     * 3. Try to identify the type of the shell based on the user environment (OS).
     * 4. If all else fail, use defaults hardcoded (cmd for windows, bash for linux & mac).
     * More information here See solution here https://github.com/microsoft/vscode/issues/74233#issuecomment-497527337
     *
     * @param {Terminal} [terminal]
     * @returns {TerminalShellType}
     * @memberof TerminalHelper
     */
    public identifyTerminalShell(terminal?: Terminal): TerminalShellType {
        let shell = TerminalShellType.other;
        const telemetryProperties: ShellIdentificationTelemetry = {
            failed: true,
            shellIdentificationSource: 'default',
            terminalProvided: !!terminal,
            hasCustomShell: undefined,
            hasShellInEnv: undefined
        };

        // Step 1. Determine shell based on the name of the terminal.
        if (terminal) {
            shell = this.identifyShellByTerminalName(terminal.name, telemetryProperties);
        }

        // Step 2. Detemrine shell based on user settings.
        if (shell === TerminalShellType.other) {
            shell = this.identifyShellFromSettings(telemetryProperties);
        }

        // Step 3. Determine shell based on user environment.
        if (shell === TerminalShellType.other) {
            shell = this.identifyShellFromUserEnv(telemetryProperties);
        }

        // This information is useful in determining how well we identify shells on users machines.
        // This impacts executing code in terminals and activation of environments in terminal.
        // So, the better this works, the better it is for the user.
        sendTelemetryEvent(EventName.TERMINAL_SHELL_IDENTIFICATION, undefined, telemetryProperties);
        traceVerbose(`Shell identified as '${shell}'`);

        // If we could not identify the shell, use the defaults.
        return shell === TerminalShellType.other ? (defaultOSShells[this.platform.osType] || TerminalShellType.other) : shell;
    }
    public getTerminalShellPath(): string | undefined {
        const shellConfig = this.workspace.getConfiguration('terminal.integrated.shell');
        let osSection = '';
        switch (this.platform.osType) {
            case OSType.Windows: {
                osSection = 'windows';
                break;
            }
            case OSType.OSX: {
                osSection = 'osx';
                break;
            }
            case OSType.Linux: {
                osSection = 'linux';
                break;
            }
            default: {
                return '';
            }
        }
        return shellConfig.get<string>(osSection)!;
    }
    public getDefaultPlatformShell(): string {
        return getDefaultShell(this.platform, this.currentProcess);
    }
    public identifyShellByTerminalName(name: string, telemetryProperties: ShellIdentificationTelemetry): TerminalShellType {
        const shell = Array.from(detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other && detectableShells.get(shellToDetect)!.test(name)) {
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);
        traceVerbose(`Terminal name '${name}' identified as shell '${shell}'`);
        telemetryProperties.shellIdentificationSource = shell === TerminalShellType.other ? telemetryProperties.shellIdentificationSource : 'terminalName';
        return shell;
    }
    public identifyShellFromSettings(telemetryProperties: ShellIdentificationTelemetry): TerminalShellType {
        const shellPath = this.getTerminalShellPath();
        telemetryProperties.hasCustomShell = !!shellPath;
        const shell = shellPath ? this.identifyShellFromShellPath(shellPath) : TerminalShellType.other;

        if (shell !== TerminalShellType.other) {
            telemetryProperties.shellIdentificationSource = 'environment';
        }
        telemetryProperties.shellIdentificationSource = 'settings';
        traceVerbose(`Shell path from user settings '${shellPath}'`);
        return shell;
    }

    public identifyShellFromUserEnv(telemetryProperties: ShellIdentificationTelemetry): TerminalShellType {
        const shellPath = this.getDefaultPlatformShell();
        telemetryProperties.hasShellInEnv = !!shellPath;
        const shell = this.identifyShellFromShellPath(shellPath);

        if (shell !== TerminalShellType.other) {
            telemetryProperties.shellIdentificationSource = 'environment';
        }
        traceVerbose(`Shell path from user env '${shellPath}'`);
        return shell;
    }
    public identifyShellFromShellPath(shellPath: string): TerminalShellType {
        const shell = Array.from(detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other && detectableShells.get(shellToDetect)!.test(shellPath)) {
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);

        traceVerbose(`Shell path '${shellPath}'`);
        traceVerbose(`Shell path identified as shell '${shell}'`);
        return shell;
    }
}

/*
 The following code is based on VS Code from https://github.com/microsoft/vscode/blob/5c65d9bfa4c56538150d7f3066318e0db2c6151f/src/vs/workbench/contrib/terminal/node/terminal.ts#L12-L55
 This is only a fall back to identify the default shell used by VSC.
 On Windows, determine the default shell.
 On others, default to bash.
*/
function getDefaultShell(platform: IPlatformService, currentProcess: ICurrentProcess): string {
    if (platform.osType === OSType.Windows) {
        return getTerminalDefaultShellWindows(platform, currentProcess);
    }

    return currentProcess.env.SHELL && currentProcess.env.SHELL !== '/bin/false' ? currentProcess.env.SHELL : '/bin/bash';
}
function getTerminalDefaultShellWindows(platform: IPlatformService, currentProcess: ICurrentProcess): string {
    const isAtLeastWindows10 = parseFloat(platform.osRelease) >= 10;
    const is32ProcessOn64Windows = currentProcess.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    const powerShellPath = `${currentProcess.env.windir}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}\\WindowsPowerShell\\v1.0\\powershell.exe`;
    return isAtLeastWindows10 ? powerShellPath : getWindowsShell(currentProcess);
}

function getWindowsShell(currentProcess: ICurrentProcess): string {
    return currentProcess.env.comspec || 'cmd.exe';
}
