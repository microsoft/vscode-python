// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { compareVersion } from '../../../../utils/version';
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
        const pythonPath = this.serviceContainer.get<IConfigurationService>(IConfigurationService)
            .getSettings(resource).pythonPath;

        const envInfo = await condaService.getCondaEnvironment(pythonPath);
        if (!envInfo) {
            return;
        }

        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            // windows activate can be a bit tricky due to conda changes.
            switch (targetShell) {
                case TerminalShellType.powershell:
                case TerminalShellType.powershellCore:
                    return this.getPowershellCommands(envInfo.name, targetShell);

                // tslint:disable-next-line:no-suspicious-comment
                // TODO: Do we really special-case fish on Windows?
                case TerminalShellType.fish:
                    return this.getFishCommands(envInfo.name, await condaService.getCondaFile());

                default:
                    return this.getWindowsCommands(envInfo.name);
            }
        } else {
            switch (targetShell) {
                case TerminalShellType.powershell:
                case TerminalShellType.powershellCore:
                    return;

                // tslint:disable-next-line:no-suspicious-comment
                // TODO: What about pre-4.4.0?
                case TerminalShellType.fish:
                    return this.getFishCommands(envInfo.name, await condaService.getCondaFile());

                default:
                    return this.getUnixCommands(
                        envInfo.name,
                        await condaService.getCondaVersion() || '',
                        await condaService.getCondaFile()
                    );
            }
        }
    }

    public async getWindowsActivateCommand(): Promise<string> {
        let activateCmd: string = 'activate';

        const condaService = this.serviceContainer.get<ICondaService>(ICondaService);
        const condaExePath = await condaService.getCondaFile();

        if (condaExePath && path.basename(condaExePath) !== condaExePath) {
            const condaScriptsPath: string = path.dirname(condaExePath);
            // prefix the cmd with the found path, and ensure it's quoted properly
            activateCmd = path.join(condaScriptsPath, activateCmd);
            activateCmd = activateCmd.toCommandArgument();
        }

        return activateCmd;
    }

    public async getWindowsCommands(
        envName: string
    ): Promise<string[] | undefined> {

        const activate = await this.getWindowsActivateCommand();
        return [
            `${activate} ${envName.toCommandArgument()}`
        ];
    }

    public async getPowershellCommands(
        envName: string,
        targetShell: TerminalShellType
    ): Promise<string[] | undefined> {
        // https://github.com/conda/conda/issues/626
        // On windows, the solution is to go into cmd, then run the batch (.bat) file and go back into powershell.
        const powershellExe = targetShell === TerminalShellType.powershell ? 'powershell' : 'pwsh';
        const activateCmd = await this.getWindowsActivateCommand();

        let cmdStyleCmd = `${activateCmd} ${envName.toCommandArgument()}`;
        // we need to double-quote any cmd quotes as we will wrap them
        // in another layer of quotes for powershell:
        cmdStyleCmd = cmdStyleCmd.replace(/"/g, '""');

        return [
            `& cmd /k "${cmdStyleCmd} & ${powershellExe}"`
        ];
    }

    public async getFishCommands(
        envName: string,
        conda: string
    ): Promise<string[] | undefined> {
        // https://github.com/conda/conda/blob/be8c08c083f4d5e05b06bd2689d2cd0d410c2ffe/shell/etc/fish/conf.d/conda.fish#L18-L28
        return [
            `${conda.fileToCommandArgument()} activate ${envName.toCommandArgument()}`
        ];
    }

    public async getUnixCommands(
        envName: string,
        version: string,
        conda: string
    ): Promise<string[] | undefined> {
        // Conda changed how activation works in the 4.4.0 release, so
        // we accommodate the two ways distinctly.
        if (version === '4.4.0' || compareVersion(version, '4.4.0') > 0) {
            // Note that this requires the user to have already followed
            // the conda instructions such that "conda" is on their
            // $PATH.  While we *could* use "source <abs-path-to-activate>"
            // (after resolving the absolute path to the "activate"
            // script), we're going to avoid operating contrary to
            // conda's recommendations.
            return [
                `${conda.fileToCommandArgument()} activate ${envName.toCommandArgument()}`
            ];
        } else {
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Handle pre-4.4 case where "activate" script not on $PATH.
            // (Locate script next to "conda" binary and use absolute path.
            return [
                `source activate ${envName.toCommandArgument()}`
            ];
        }
    }
}
