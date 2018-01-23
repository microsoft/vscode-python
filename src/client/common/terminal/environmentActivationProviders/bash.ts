// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { PythonInterpreter } from '../../../interpreter/contracts';
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
    public async getActivationCommands(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const scriptFile = await this.findScriptFile(interpreter, ['activate', 'activate.sh', 'activate.csh', 'activate.fish']);
        if (!scriptFile) {
            return;
        }
        const envName = interpreter.envName ? interpreter.envName! : '';
        // In the case of conda environments, the name of the environment must be provided.
        // E.g. `source acrtivate <envname>`.
        return [`source ${scriptFile.toCommandArgument()} ${envName}`.trim()];
    }
}
