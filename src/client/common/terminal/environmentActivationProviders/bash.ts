// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class Bash extends BaseActivationCommandProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return (
            targetShell === TerminalShellType.bash ||
            targetShell === TerminalShellType.gitbash ||
            targetShell === TerminalShellType.wsl ||
            targetShell === TerminalShellType.ksh ||
            targetShell === TerminalShellType.zsh ||
            targetShell === TerminalShellType.cshell ||
            targetShell === TerminalShellType.tcshell ||
            targetShell === TerminalShellType.fish
        );
    }
    public async getActivationCommandsForInterpreter(pythonPath: string, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const scriptFile = await this.findScriptFile(pythonPath, this.getScriptsInOrderOfPreference(targetShell));
        if (!scriptFile) {
            return;
        }
        return [`source ${scriptFile.fileToCommandArgument()}`];
    }

    private getScriptsInOrderOfPreference(targetShell: TerminalShellType): string[] {
        switch (targetShell) {
            case TerminalShellType.wsl:
            case TerminalShellType.ksh:
            case TerminalShellType.zsh:
            case TerminalShellType.gitbash:
            case TerminalShellType.bash: {
                return ['activate.sh', 'activate'];
            }
            case TerminalShellType.tcshell:
            case TerminalShellType.cshell: {
                return ['activate.csh'];
            }
            case TerminalShellType.fish: {
                return ['activate.fish'];
            }
            default: {
                return [];
            }
        }
    }
}
