// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class CommandPrompt extends BaseActivationCommandProvider {
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, ['activate.bat']);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.commandPrompt ||
            targetShell === TerminalShellType.powershell;
    }
    public async getActivationCommand(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string | undefined> {
        const scriptFile = await this.findScriptFile(interpreter);
        if (!scriptFile) {
            return;
        }
        // Batch files can only be run from command prompt or powershell, all others are not supported.
        switch (targetShell) {
            case TerminalShellType.commandPrompt: {
                return scriptFile;
            }
            case TerminalShellType.powershell: {
                return scriptFile.indexOf(' ') > 0 ? `& "${scriptFile}"` : scriptFile;
            }
            default: {
                return;
            }
        }
    }
}
