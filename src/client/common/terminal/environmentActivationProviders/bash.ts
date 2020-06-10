// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { TerminalShellType } from '../types';
import { ActivationScripts, VenvBaseActivationCommandProvider } from './baseActivationProvider';

// For a given shell the scripts are in order of precedence.
export const SCRIPTS: ActivationScripts = ({
    // Group 1
    [TerminalShellType.wsl]: ['activate.sh', 'activate'],
    [TerminalShellType.ksh]: ['activate.sh', 'activate'],
    [TerminalShellType.zsh]: ['activate.sh', 'activate'],
    [TerminalShellType.gitbash]: ['activate.sh', 'activate'],
    [TerminalShellType.bash]: ['activate.sh', 'activate'],
    // Group 2
    [TerminalShellType.tcshell]: ['activate.csh'],
    [TerminalShellType.cshell]: ['activate.csh'],
    // Group 3
    [TerminalShellType.fish]: ['activate.fish']
} as unknown) as ActivationScripts;

@injectable()
export class Bash extends VenvBaseActivationCommandProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(SCRIPTS, serviceContainer);
    }
    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        targetShell: TerminalShellType
    ): Promise<string[] | undefined> {
        const scriptFile = await this.findScriptFile(pythonPath, targetShell);
        if (!scriptFile) {
            return;
        }
        return [`source ${scriptFile.fileToCommandArgument()}`];
    }
}
