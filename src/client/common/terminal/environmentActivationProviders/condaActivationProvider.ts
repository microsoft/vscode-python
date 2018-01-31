// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ICondaService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { IPlatformService } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { TerminalShellType } from '../types';
import { ITerminalActivationCommandProvider } from '../types';

@injectable()
export class CondaActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(private readonly serviceContainer: IServiceContainer) { }

    public isShellSupported(_targetShell: TerminalShellType): boolean {
        return true;
    }
    public async getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const condaService = this.serviceContainer.get<ICondaService>(ICondaService);
        const pythonPath = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath;

        const envInfo = await condaService.getCondaEnvironment(pythonPath);
        if (!envInfo) {
            return;
        }

        const isWindows = this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows;
        if (targetShell === TerminalShellType.powershell || targetShell === TerminalShellType.powershellCore) {
            // https://github.com/conda/conda/issues/626
            return;
        } else if (targetShell === TerminalShellType.fish) {
            // https://github.com/conda/conda/blob/be8c08c083f4d5e05b06bd2689d2cd0d410c2ffe/shell/etc/fish/conf.d/conda.fish#L18-L28
            return [`conda activate ${envInfo.name.toCommandArgument()}`];
        } else if (isWindows) {
            return [`activate ${envInfo.name.toCommandArgument()}`];
        } else {
            return [`source activate ${envInfo.name.toCommandArgument()}`];
        }
    }
}
