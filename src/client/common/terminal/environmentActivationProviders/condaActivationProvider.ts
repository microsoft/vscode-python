// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '../../extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';

import { IComponentAdapter, ICondaService } from '../../../interpreter/contracts';
import { IPlatformService } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

// Version number of conda that requires we call activate with 'conda activate' instead of just 'activate'
const CondaRequiredMajor = 4;
const CondaRequiredMinor = 4;
const CondaRequiredMinorForPowerShell = 6;

/**
 * Support conda env activation (in the terminal).
 */
@injectable()
export class CondaActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IPlatformService) private platform: IPlatformService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IComponentAdapter) private pyenvs: IComponentAdapter,
    ) {}

    /**
     * Is the given shell supported for activating a conda env?
     */
    // eslint-disable-next-line class-methods-use-this
    public isShellSupported(): boolean {
        return true;
    }

    /**
     * Return the command needed to activate the conda env.
     */
    public getActivationCommands(
        resource: Uri | undefined,
        targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        const { pythonPath } = this.configService.getSettings(resource);
        return this.getActivationCommandsForInterpreter(pythonPath, targetShell);
    }

    /**
     * Return the command needed to activate the conda env.
     *
     */
    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        const envInfo = await this.pyenvs.getCondaEnvironment(pythonPath);
        if (!envInfo) {
            return undefined;
        }

        const condaEnv = envInfo.name.length > 0 ? envInfo.name : envInfo.path;

        // Algorithm differs based on version
        // Old version, just call activate directly.
        // New version, call activate from the same path as our python path, then call it again to activate our environment.
        // -- note that the 'default' conda location won't allow activate to work for the environment sometimes.
        const versionInfo = await this.condaService.getCondaVersion();
        if (versionInfo && versionInfo.major >= CondaRequiredMajor) {
            // Conda added support for powershell in 4.6.
            if (
                versionInfo.minor >= CondaRequiredMinorForPowerShell &&
                (targetShell === TerminalShellType.powershell || targetShell === TerminalShellType.powershellCore)
            ) {
                return _getPowershellCommands(condaEnv);
            }
            if (versionInfo.minor >= CondaRequiredMinor) {
                // New version.
                const interpreterPath = await this.condaService.getInterpreterPathForEnvironment(envInfo);
                const activatePath = await this.condaService.getActivationScriptFromInterpreter(
                    interpreterPath,
                    envInfo.name,
                );
                // eslint-disable-next-line camelcase
                if (activatePath?.path) {
                    if (
                        this.platform.isWindows &&
                        targetShell !== TerminalShellType.bash &&
                        targetShell !== TerminalShellType.gitbash
                    ) {
                        return [activatePath.path, `conda activate ${condaEnv.toCommandArgumentForPythonExt()}`];
                    }

                    const condaInfo = await this.condaService.getCondaInfo();

                    if (
                        activatePath.type !== 'global' ||
                        // eslint-disable-next-line camelcase
                        condaInfo?.conda_shlvl === undefined ||
                        condaInfo.conda_shlvl === -1
                    ) {
                        // activatePath is not the global activate path, or we don't have a shlvl, or it's -1（conda never sourced）.
                        // and we need to source the activate path.
                        if (activatePath.path === 'activate') {
                            return [
                                `source ${activatePath.path}`,
                                `conda activate ${condaEnv.toCommandArgumentForPythonExt()}`,
                            ];
                        }
                        return [`source ${activatePath.path} ${condaEnv.toCommandArgumentForPythonExt()}`];
                    }
                    return [`conda activate ${condaEnv.toCommandArgumentForPythonExt()}`];
                }
            }
        }

        switch (targetShell) {
            case TerminalShellType.powershell:
            case TerminalShellType.powershellCore:
                return _getPowershellCommands(condaEnv);

            // TODO: Do we really special-case fish on Windows?
            case TerminalShellType.fish:
                return getFishCommands(condaEnv, await this.condaService.getCondaFile());

            default:
                if (this.platform.isWindows) {
                    return this.getWindowsCommands(condaEnv);
                }
                return getUnixCommands(condaEnv, await this.condaService.getCondaFile());
        }
    }

    public async getWindowsActivateCommand(): Promise<string> {
        let activateCmd = 'activate';

        const condaExePath = await this.condaService.getCondaFile();

        if (condaExePath && path.basename(condaExePath) !== condaExePath) {
            const condaScriptsPath: string = path.dirname(condaExePath);
            // prefix the cmd with the found path, and ensure it's quoted properly
            activateCmd = path.join(condaScriptsPath, activateCmd);
            activateCmd = activateCmd.toCommandArgumentForPythonExt();
        }

        return activateCmd;
    }

    public async getWindowsCommands(condaEnv: string): Promise<string[] | undefined> {
        const activate = await this.getWindowsActivateCommand();
        return [`${activate} ${condaEnv.toCommandArgumentForPythonExt()}`];
    }
}

/**
 * The expectation is for the user to configure Powershell for Conda.
 * Hence we just send the command `conda activate ...`.
 * This configuration is documented on Conda.
 * Extension will not attempt to work around issues by trying to setup shell for user.
 */
export async function _getPowershellCommands(condaEnv: string): Promise<string[] | undefined> {
    return [`conda activate ${condaEnv.toCommandArgumentForPythonExt()}`];
}

async function getFishCommands(condaEnv: string, condaFile: string): Promise<string[] | undefined> {
    // https://github.com/conda/conda/blob/be8c08c083f4d5e05b06bd2689d2cd0d410c2ffe/shell/etc/fish/conf.d/conda.fish#L18-L28
    return [`${condaFile.fileToCommandArgumentForPythonExt()} activate ${condaEnv.toCommandArgumentForPythonExt()}`];
}

async function getUnixCommands(condaEnv: string, condaFile: string): Promise<string[] | undefined> {
    const condaDir = path.dirname(condaFile);
    const activateFile = path.join(condaDir, 'activate');
    return [`source ${activateFile.fileToCommandArgumentForPythonExt()} ${condaEnv.toCommandArgumentForPythonExt()}`];
}
