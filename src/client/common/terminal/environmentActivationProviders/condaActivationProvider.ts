// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';

import { ICondaService } from '../../../interpreter/contracts';
import { IPlatformService } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

// Version number of conda that requires we call activate with 'conda activate' instead of just 'activate'
const CondaRequiredMajor = 4;
const CondaRequiredMinor = 4;

/**
 * Support conda env activation (in the terminal).
 */
@injectable()
export class CondaActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}

    /**
     * Is the given shell supported for activating a conda env?
     */
    public isShellSupported(_targetShell: TerminalShellType): boolean {
        return true;
    }

    /**
     * Return the command needed to activate the conda env.
     */
    public getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const pythonPath = this.configService.getSettings(resource).pythonPath;
        return this.getActivationCommandsForInterpreter(pythonPath, targetShell);
    }

    /**
     * Return the command needed to activate the conda env.
     *
     */
    public async getActivationCommandsForInterpreter(pythonPath: string, targetShell: TerminalShellType): Promise<string[] | undefined> {
        const envInfo = await this.condaService.getCondaEnvironment(pythonPath);
        if (!envInfo) {
            return;
        }

        // Algorithm differs based on version
        // Old version, just call activate directly.
        // New version, call activate from the same path as our python path, then call it again to activate our environment.
        // -- note that the 'default' conda location won't allow activate to work for the environment sometimes.
        const versionInfo = await this.condaService.getCondaVersion();
        if (versionInfo && (versionInfo.major > CondaRequiredMajor || (versionInfo.major === CondaRequiredMajor && versionInfo.minor >= CondaRequiredMinor))) {
            // New version.
            const interpreterPath = await this.condaService.getCondaFileFromInterpreter(pythonPath, envInfo.name);
            if (interpreterPath) {
                const activatePath = path.join(path.dirname(interpreterPath), 'activate').fileToCommandArgument();
                const firstActivate = this.platform.isWindows ? activatePath : `source ${activatePath}`;
                return [firstActivate, `conda activate ${envInfo.name.toCommandArgument()}`];
            }
        }

        switch (targetShell) {
            case TerminalShellType.powershell:
            case TerminalShellType.powershellCore:
                return this.getPowershellCommands(envInfo.name);

            // tslint:disable-next-line:no-suspicious-comment
            // TODO: Do we really special-case fish on Windows?
            case TerminalShellType.fish:
                return this.getFishCommands(envInfo.name, await this.condaService.getCondaFile());

            default:
                if (this.platform.isWindows) {
                    return this.getWindowsCommands(envInfo.name);
                } else {
                    return this.getUnixCommands(envInfo.name, await this.condaService.getCondaFile());
                }
        }
    }

    public async getWindowsActivateCommand(): Promise<string> {
        let activateCmd: string = 'activate';

        const condaExePath = await this.condaService.getCondaFile();

        if (condaExePath && path.basename(condaExePath) !== condaExePath) {
            const condaScriptsPath: string = path.dirname(condaExePath);
            // prefix the cmd with the found path, and ensure it's quoted properly
            activateCmd = path.join(condaScriptsPath, activateCmd);
            activateCmd = activateCmd.toCommandArgument();
        }

        return activateCmd;
    }

    public async getWindowsCommands(envName: string): Promise<string[] | undefined> {
        const activate = await this.getWindowsActivateCommand();
        return [`${activate} ${envName.toCommandArgument()}`];
    }
    /**
     * The expectation is for the user to configure Powershell for Conda.
     * Hence we just send the command `conda activate ...`.
     * This configuration is documented on Conda.
     * Extension will not attempt to work around issues by trying to setup shell for user.
     *
     * @param {string} envName
     * @returns {(Promise<string[] | undefined>)}
     * @memberof CondaActivationCommandProvider
     */
    public async getPowershellCommands(envName: string): Promise<string[] | undefined> {
        return [`conda activate ${envName.toCommandArgument()}`];
    }

    public async getFishCommands(envName: string, conda: string): Promise<string[] | undefined> {
        // https://github.com/conda/conda/blob/be8c08c083f4d5e05b06bd2689d2cd0d410c2ffe/shell/etc/fish/conf.d/conda.fish#L18-L28
        return [`${conda.fileToCommandArgument()} activate ${envName.toCommandArgument()}`];
    }

    public async getUnixCommands(envName: string, conda: string): Promise<string[] | undefined> {
        const condaDir = path.dirname(conda);
        const activateFile = path.join(condaDir, 'activate');
        return [`source ${activateFile.fileToCommandArgument()} ${envName.toCommandArgument()}`];
    }
}
