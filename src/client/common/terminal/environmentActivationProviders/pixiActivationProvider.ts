/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterService } from '../../../interpreter/contracts';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';
import { traceError } from '../../../logging';
import {
    getPixiEnvironmentFromInterpreter,
    isNonDefaultPixiEnvironmentName,
} from '../../../pythonEnvironments/common/environmentManagers/pixi';
import { exec } from '../../../pythonEnvironments/common/externalDependencies';
import { splitLines } from '../../stringUtils';

@injectable()
export class PixiActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(@inject(IInterpreterService) private readonly interpreterService: IInterpreterService) {}

    // eslint-disable-next-line class-methods-use-this
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return shellTypeToPixiShell(targetShell) !== undefined;
    }

    public async getActivationCommands(
        resource: Uri | undefined,
        targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (!interpreter) {
            return undefined;
        }

        return this.getActivationCommandsForInterpreter(interpreter.path, targetShell);
    }

    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        const pixiEnv = await getPixiEnvironmentFromInterpreter(pythonPath);
        if (!pixiEnv) {
            return undefined;
        }

        const command = ['shell-hook', '--manifest-path', pixiEnv.manifestPath];
        if (isNonDefaultPixiEnvironmentName(pixiEnv.envName)) {
            command.push('--environment');
            command.push(pixiEnv.envName);
        }

        const pixiTargetShell = shellTypeToPixiShell(targetShell);
        if (pixiTargetShell) {
            command.push('--shell');
            command.push(pixiTargetShell);
        }

        const shellHookOutput = await exec(pixiEnv.pixi.command, command, {
            throwOnStdErr: false,
        }).catch(traceError);
        if (!shellHookOutput) {
            return undefined;
        }

        return splitLines(shellHookOutput.stdout, {
            removeEmptyEntries: true,
            trim: true,
        });
    }
}

/**
 * Returns the name of a terminal shell type within Pixi.
 */
function shellTypeToPixiShell(targetShell: TerminalShellType): string | undefined {
    switch (targetShell) {
        case TerminalShellType.powershell:
        case TerminalShellType.powershellCore:
            return 'powershell';
        case TerminalShellType.commandPrompt:
            return 'cmd';

        case TerminalShellType.zsh:
            return 'zsh';

        case TerminalShellType.fish:
            return 'fish';

        case TerminalShellType.nushell:
            return 'nushell';

        case TerminalShellType.xonsh:
            return 'xonsh';

        case TerminalShellType.cshell:
            // Explicitly unsupported
            return undefined;

        case TerminalShellType.gitbash:
        case TerminalShellType.bash:
        case TerminalShellType.wsl:
        case TerminalShellType.tcshell:
        case TerminalShellType.other:
        default:
            return 'bash';
    }
}
