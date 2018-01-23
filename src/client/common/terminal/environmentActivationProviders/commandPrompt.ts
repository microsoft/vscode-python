// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class CommandPromptAndPowerShell extends BaseActivationCommandProvider {
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.commandPrompt ||
            targetShell === TerminalShellType.powershell;
    }
    public async getActivationCommands(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string | string[] | undefined> {
        // Dependending on the target shell, look for the preferred script file.
        const scriptsInOrderOfPreference = targetShell === TerminalShellType.commandPrompt ? ['activate.bat', 'activate.ps1'] : ['activate.ps1', 'activate.bat'];
        const scriptFile = await this.findScriptFile(interpreter, scriptsInOrderOfPreference);
        if (!scriptFile) {
            return;
        }

        const quotedScriptFile = scriptFile.indexOf(' ') > 0 ? `"${scriptFile}` : scriptFile;
        const arg = interpreter.envName ? interpreter.envName! : '';

        if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('activate.bat')) {
            return `${quotedScriptFile} ${arg}`.trim();
        } else if (targetShell === TerminalShellType.powershell && scriptFile.endsWith('activate.ps1')) {
            return `${quotedScriptFile} ${arg}`.trim();
        } else if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('activate.ps1')) {
            return `powershell ${quotedScriptFile} ${arg}`.trim();
        } else {
            // This means we're in powershell and we have a .bat file.
            // Solution is to go into cmd, then run the batch (.bat) file and go back into powershell.
            return [
                'cmd',
                `${quotedScriptFile} ${arg}`.trim(),
                'powershell'
            ];
        }
    }
}
