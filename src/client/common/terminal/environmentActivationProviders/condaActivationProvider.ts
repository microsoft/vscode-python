// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { compareVersion } from '../../../../utils/version';
import { ICondaService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { IPlatformService } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

interface ICondaInfo {
    name: string;
    path: string;
}

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

        // Conda changed how activation works in the 4.4.0 release, so
        // we accommodate the two ways distinctly.
        const versionStr = await condaService.getCondaVersion();
        if (compareVersion(versionStr || '', '4.4.0') === 0) {
            return this.getPre440(targetShell, condaService, envInfo);
        } else {
            return this.getCurrent(targetShell, condaService, envInfo);
        }
    }

    private async getPre440(
        targetShell: TerminalShellType,
        condaService: ICondaService,
        envInfo: ICondaInfo
    ): Promise<string[] | undefined> {
        return this.getCurrent(targetShell, condaService, envInfo);
    }

    private async getCurrent(
        targetShell: TerminalShellType,
        condaService: ICondaService,
        envInfo: ICondaInfo
    ): Promise<string[] | undefined> {
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
            const conda = await condaService.getCondaFile();
            // https://github.com/conda/conda/blob/be8c08c083f4d5e05b06bd2689d2cd0d410c2ffe/shell/etc/fish/conf.d/conda.fish#L18-L28
            return [`${conda.fileToCommandArgument()} activate ${envInfo.name.toCommandArgument()}`];
        } else if (isWindows) {
            return [`activate ${envInfo.name.toCommandArgument()}`];
        } else {
            return [`source activate ${envInfo.name.toCommandArgument()}`];
        }
    }
}
