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
        super(serviceContainer);
    }
    public isShellSupported(targetShell: TerminalShellType): boolean {
        return targetShell === TerminalShellType.bash ||
            targetShell === TerminalShellType.cshell ||
            targetShell === TerminalShellType.fish;
    }
    public async getActivationCommands(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string | string[] | undefined> {
        const scriptFile = await this.findScriptFile(interpreter, ['activate', 'activate.sh', 'activate.csh', 'activate.fish']);
        if (!scriptFile) {
            return;
        }
        const quotedScriptFile = scriptFile.indexOf(' ') > 0 ? `"${scriptFile}"` : scriptFile;
        const arg = interpreter.envName ? interpreter.envName! : '';
        return `source ${quotedScriptFile} ${arg}`.trim();
    }
}
