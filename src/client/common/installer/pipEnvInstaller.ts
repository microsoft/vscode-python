// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterLocatorService, PIPENV_SERVICE } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ITerminalServiceFactory } from '../terminal/types';
import { IModuleInstaller } from './types';

const pipenvName = 'pipenv';

@injectable()
export class PipEnvInstaller implements IModuleInstaller {
    private readonly pipenv: IInterpreterLocatorService;

    public get displayName() {
        return pipenvName;
    }
    public get priority(): number {
        return 10;
    }

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.pipenv = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, PIPENV_SERVICE);
    }

    public installModule(name: string, resource?: Uri): Promise<void> {
        const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory).getTerminalService(resource);
        return terminalService.sendCommand(pipenvName, ['install', name, '--dev']);
    }

    public async isSupported(resource?: Uri): Promise<boolean> {
        const interpreters = await this.pipenv.getInterpreters(resource);
        return interpreters && interpreters.length > 0;
    }
}
