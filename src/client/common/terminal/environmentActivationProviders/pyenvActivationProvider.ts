// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { EnvironmentType } from '../../../pythonEnvironments/info';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

@injectable()
export class PyEnvActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}

    public isShellSupported(_targetShell: TerminalShellType): boolean {
        return true;
    }

    public async getActivationCommands(resource: Uri | undefined, _: TerminalShellType): Promise<string[] | undefined> {
        console.log('Should not be here3');
        const lalal = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource)
            .pythonPath;
        console.log('Log lalalala', lalal);
        const interpreter = await this.serviceContainer
            .get<IInterpreterService>(IInterpreterService)
            .getActiveInterpreter(resource);
        console.log('Log interpreters', interpreter);
        if (!interpreter || interpreter.envType !== EnvironmentType.Pyenv || !interpreter.envName) {
            return;
        }
        console.log('not here');

        return [`pyenv shell ${interpreter.envName.toCommandArgument()}`];
    }

    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        _targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        const interpreter = await this.serviceContainer
            .get<IInterpreterService>(IInterpreterService)
            .getInterpreterDetails(pythonPath);
        if (!interpreter || interpreter.envType !== EnvironmentType.Pyenv || !interpreter.envName) {
            return;
        }

        return [`pyenv shell ${interpreter.envName.toCommandArgument()}`];
    }
}
