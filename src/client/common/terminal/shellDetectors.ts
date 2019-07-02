// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, unmanaged } from 'inversify';
import { Terminal } from 'vscode';
import { IWorkspaceService } from '../application/types';
import '../extensions';
import { traceVerbose } from '../logger';
import { IPlatformService } from '../platform/types';
import { ICurrentProcess } from '../types';
import { OSType } from '../utils/platform';
import { IShellDetector, ShellIdentificationTelemetry, TerminalShellType } from './types';

// tslint:disable: max-classes-per-file

/*
When identifying the shell use the following algorithm:
* 1. Identify shell based on the name of the terminal (if there is one already opened and used).
* 2. Identify shell based on the settings in VSC.
* 3. Identify shell based on users environment variables.
* 4. Use default shells (bash for mac and linux, cmd for windows).
*/

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
export abstract class BaseShellDetector implements IShellDetector {
    constructor(@unmanaged() public readonly priority: number) { }
    public abstract identifyTerminalShell(telemetryProperties: ShellIdentificationTelemetry, terminal?: Terminal): TerminalShellType | undefined;
    public identifyShellFromShellPath(shellPath: string): TerminalShellType {
        const shell = Array.from(detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other) {
                    const pat = detectableShells.get(shellToDetect);
                    if (pat!.test(shellPath)) {
                        return shellToDetect;
                    }
                }
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);

        traceVerbose(`Shell path '${shellPath}'`);
        traceVerbose(`Shell path identified as shell '${shell}'`);
        return shell;
    }
}

/**
 * Identifies the shell, based on the display name of the terminal.
 *
 * @export
 * @class TerminalNameShellDetector
 * @extends {BaseShellDetector}
 */
@injectable()
export class TerminalNameShellDetector extends BaseShellDetector {
    constructor() { super(0); }
    public identifyTerminalShell(telemetryProperties: ShellIdentificationTelemetry, terminal?: Terminal): TerminalShellType | undefined {
        if (!terminal) {
            return;
        }
        const shell = Array.from(detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
                if (matchedShell === TerminalShellType.other && detectableShells.get(shellToDetect)!.test(terminal.name)) {
                    return shellToDetect;
                }
                return matchedShell;
            }, TerminalShellType.other);
        traceVerbose(`Terminal name '${terminal.name}' identified as shell '${shell}'`);
        telemetryProperties.shellIdentificationSource = shell === TerminalShellType.other ? telemetryProperties.shellIdentificationSource : 'terminalName';
        return shell;
    }
}
/**
 * Identifies the shell based on the user settings.
 *
 * @export
 * @class SettingsShellDetector
 * @extends {BaseShellDetector}
 */
@injectable()
export class SettingsShellDetector extends BaseShellDetector {
    constructor(@inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IPlatformService) private readonly platform: IPlatformService) {
        super(1);
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
    public identifyTerminalShell(telemetryProperties: ShellIdentificationTelemetry, _terminal?: Terminal): TerminalShellType | undefined {
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
}
/**
 * Identifies the shell based on the users environment (env variables).
 *
 * @export
 * @class UserEnvironmentShellDetector
 * @extends {BaseShellDetector}
 */
@injectable()
export class UserEnvironmentShellDetector extends BaseShellDetector {
    constructor(@inject(ICurrentProcess) private readonly currentProcess: ICurrentProcess,
        @inject(IPlatformService) private readonly platform: IPlatformService) {
        super(2);
    }
    public getDefaultPlatformShell(): string {
        return getDefaultShell(this.platform, this.currentProcess);
    }
    public identifyTerminalShell(telemetryProperties: ShellIdentificationTelemetry, _terminal?: Terminal): TerminalShellType | undefined {
        const shellPath = this.getDefaultPlatformShell();
        telemetryProperties.hasShellInEnv = !!shellPath;
        const shell = this.identifyShellFromShellPath(shellPath);

        if (shell !== TerminalShellType.other) {
            telemetryProperties.shellIdentificationSource = 'environment';
        }
        traceVerbose(`Shell path from user env '${shellPath}'`);
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
