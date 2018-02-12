// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class Bash extends BaseActivationCommandProvider {
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.bash ||
            targetShell === TerminalShellType.cshell ||
            targetShell === TerminalShellType.fish;
    }
    public async getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const scriptFile = await this.findScriptFile(resource, this.getScriptsInOrderOfPreference(targetShell));
        if (!scriptFile) {
            return;
        }
        return [`source ${scriptFile.fileToCommandArgument()}`];
    }

    private getScriptsInOrderOfPreference(targetShell: TerminalShellType): string[] {
        switch (targetShell) {
            case TerminalShellType.bash: {
                return ['activate.sh', 'activate'];
            }
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
