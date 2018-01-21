// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class Powershell extends BaseActivationCommandProvider {
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, ['activate.ps1']);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.powershell;
    }
    public async getActivationCommand(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string | undefined> {
        const scriptFile = await this.findScriptFile(interpreter);
        if (!scriptFile) {
            return;
        }
        if (targetShell === TerminalShellType.powershell) {
            return scriptFile.indexOf(' ') > 0 ? `& "${scriptFile}"` : scriptFile;
        }
    }
}
