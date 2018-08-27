// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { ICondaService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { IPlatformService } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

/**
 * Support conda env activation (in the terminal).
 */
@injectable()
export class CondaActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(
        private readonly serviceContainer: IServiceContainer
    ) { }

    /**
     * Is the given shell supported for activating a conda env?
     */
    public isShellSupported(_targetShell: TerminalShellType): boolean {
        return true;
    }

    /**
     * Return the command needed to activate the conda env.
     */
    public async getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const condaService = this.serviceContainer.get<ICondaService>(ICondaService);
        const pythonPath = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath;

        const envInfo = await condaService.getCondaEnvironment(pythonPath);
        if (!envInfo) {
            return;
        }

        const isWindows = this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows;
        if (targetShell === TerminalShellType.powershell || targetShell === TerminalShellType.powershellCore) {
            if (!isWindows) {
                return;
            }
            // https://github.com/conda/conda/issues/626
            // On windows, the solution is to go into cmd, then run the batch (.bat) file and go back into powershell.
            const powershellExe = targetShell === TerminalShellType.powershell ? 'powershell' : 'pwsh';
            return [
                `& cmd /k "activate ${envInfo.name.toCommandArgument().replace(/"/g, '""')} & ${powershellExe}"`
            ];
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
