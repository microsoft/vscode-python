// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, unmanaged } from 'inversify';
import { Terminal } from 'vscode';
import { traceVerbose } from '../../logger';
import { IShellDetector, ShellIdentificationTelemetry, TerminalShellType } from '../types';

// tslint:disable: max-classes-per-file

/*
When identifying the shell use the following algorithm:
* 1. Identify shell based on the name of the terminal (if there is one already opened and used).
* 2. Identify shell based on the api provided by VSC.
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
    constructor(@unmanaged() public readonly priority: number) {}
    public abstract identify(
        telemetryProperties: ShellIdentificationTelemetry,
        terminal?: Terminal,
    ): TerminalShellType | undefined;
    public identifyShellFromShellPath(shellPath: string): TerminalShellType {
        const shell = Array.from(detectableShells.keys()).reduce((matchedShell, shellToDetect) => {
            if (matchedShell === TerminalShellType.other) {
                const pat = detectableShells.get(shellToDetect);
                if (pat && pat.test(shellPath)) {
                    return shellToDetect;
                }
            }
            return matchedShell;
        }, TerminalShellType.other);

        traceVerbose(`Shell path '${shellPath}'`);
        traceVerbose(`Shell path identified as shell '${shell}'`);
        return shell;
    }
}
