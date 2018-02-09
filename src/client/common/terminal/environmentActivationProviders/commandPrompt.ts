// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { IPlatformService } from '../../platform/types';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class CommandPromptAndPowerShell extends BaseActivationCommandProvider {
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.commandPrompt ||
            targetShell === TerminalShellType.powershell ||
            targetShell === TerminalShellType.powershellCore;
    }
    public async getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined> {
        // Dependending on the target shell, look for the preferred script file.
        const scriptFile = await this.findScriptFile(resource, this.getScriptsInOrderOfPreference(targetShell));
        if (!scriptFile) {
            return;
        }

        if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('activate.bat')) {
            return [scriptFile.fileToCommandArgument()];
        } else if ((targetShell === TerminalShellType.powershell || targetShell === TerminalShellType.powershellCore) && scriptFile.endsWith('activate.ps1')) {
            return [`& ${scriptFile.fileToCommandArgument()}`];
        } else if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('activate.ps1')) {
            // lets not try to run the powershell file from command prompt (user may not have powershell)
            return [];
        } else {
            // This means we're in powershell and we have a .bat file.
            if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
                // On windows, the solution is to go into cmd, then run the batch (.bat) file and go back into powershell.
                const powershellExe = targetShell === TerminalShellType.powershell ? 'powershell' : 'pwsh';
                const activationCmd = scriptFile.fileToCommandArgument();
                return [
                    `& cmd /k "${activationCmd} & ${powershellExe}"`
                ];
            } else {
                // Powershell on non-windows os, we cannot execute the batch file.
                return;
            }
        }
    }

    private getScriptsInOrderOfPreference(targetShell: TerminalShellType): string[] {
        const batchFiles = ['activate.bat', path.join('Scripts', 'activate.bat'), path.join('scripts', 'activate.bat')];
        const powerShellFiles = ['activate.ps1', path.join('Scripts', 'activate.ps1'), path.join('scripts', 'activate.ps1')];
        if (targetShell === TerminalShellType.commandPrompt) {
            return batchFiles.concat(powerShellFiles);
        } else {
            return powerShellFiles.concat(batchFiles);
        }
    }
}
