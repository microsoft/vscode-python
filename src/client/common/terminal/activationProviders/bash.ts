// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { TerminalShellType } from '../types';
import { BaseActivationCommandProvider } from './baseActivationProvider';

@injectable()
export class Bash extends BaseActivationCommandProvider {
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer, ['activate', 'activte.sh']);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.bash;
    }
    public async getActivationCommand(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string | undefined> {
        const scriptFile = await this.findScriptFile(interpreter);
        if (!scriptFile) {
            return;
        }
        // Batch files can only be run from bash or sh.
        if (targetShell === TerminalShellType.bash) {
            return scriptFile.indexOf(' ') > 0 ? `source "${scriptFile}"` : `source "${scriptFile}"`;
        }
    }
}
