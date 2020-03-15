// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class CommandPromptAndPowerShell extends BaseActivationCommandProvider {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return (
            targetShell === TerminalShellType.commandPrompt ||
            targetShell === TerminalShellType.powershell ||
            targetShell === TerminalShellType.powershellCore
        );
    }
    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        targetShell: TerminalShellType
    ): Promise<string[] | undefined> {
        // Dependending on the target shell, look for the preferred script file.
        const scriptFile = await this.findScriptFile(pythonPath, this.getScriptsInOrderOfPreference(targetShell));
        if (!scriptFile) {
            return;
        }

        if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('activate.bat')) {
            return [scriptFile.fileToCommandArgument()];
        } else if (
            (targetShell === TerminalShellType.powershell || targetShell === TerminalShellType.powershellCore) &&
            scriptFile.endsWith('Activate.ps1')
        ) {
            return [`& ${scriptFile.fileToCommandArgument()}`];
        } else if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('Activate.ps1')) {
            // lets not try to run the powershell file from command prompt (user may not have powershell)
            return [];
        } else {
            return;
        }
    }

    private getScriptsInOrderOfPreference(targetShell: TerminalShellType): string[] {
        const batchFiles = ['activate.bat', path.join('Scripts', 'activate.bat'), path.join('scripts', 'activate.bat')];
        const powerShellFiles = [
            'Activate.ps1',
            path.join('Scripts', 'Activate.ps1'),
            path.join('scripts', 'Activate.ps1')
        ];
        if (targetShell === TerminalShellType.commandPrompt) {
            return batchFiles.concat(powerShellFiles);
        } else {
            return powerShellFiles.concat(batchFiles);
        }
    }
}
