// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IServiceContainer } from '../../../ioc/types';
import '../../extensions';
import { TerminalShellType } from '../types';
import { ActivationScripts, VenvBaseActivationCommandProvider } from './baseActivationProvider';

// For a given shell the scripts are in order of precedence.
const SCRIPTS: ActivationScripts = ({
    // Group 1
    [TerminalShellType.commandPrompt]: ['activate.bat', 'Activate.ps1'],
    // Group 2
    [TerminalShellType.powershell]: ['Activate.ps1', 'activate.bat'],
    [TerminalShellType.powershellCore]: ['Activate.ps1', 'activate.bat'],
} as unknown) as ActivationScripts;

export function getAllScripts(pathJoin: (...p: string[]) => string): string[] {
    const scripts: string[] = [];
    for (const key of Object.keys(SCRIPTS)) {
        const shell = key as TerminalShellType;
        for (const name of SCRIPTS[shell]) {
            if (!scripts.includes(name)) {
                scripts.push(
                    name,
                    // We also add scripts in subdirs.
                    pathJoin('Scripts', name),
                    pathJoin('scripts', name),
                );
            }
        }
    }
    return scripts;
}

@injectable()
export class CommandPromptAndPowerShell extends VenvBaseActivationCommandProvider {
    protected readonly scripts: ActivationScripts;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
        this.scripts = ({} as unknown) as ActivationScripts;
        for (const key of Object.keys(SCRIPTS)) {
            const shell = key as TerminalShellType;
            const scripts: string[] = [];
            for (const name of SCRIPTS[shell]) {
                scripts.push(
                    name,
                    // We also add scripts in subdirs.
                    path.join('Scripts', name),
                    path.join('scripts', name),
                );
            }
            this.scripts[shell] = scripts;
        }
    }

    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        console.log('Finding the script file');
        const scriptFile = await this.findScriptFile(pythonPath, targetShell);
        if (!scriptFile) {
            return;
        }

        if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('activate.bat')) {
            return [scriptFile.fileToCommandArgument()];
        } else if (
            (targetShell === TerminalShellType.powershell || targetShell === TerminalShellType.powershellCore) &&
            scriptFile.endsWith('Activate.ps1')
        ) {
            return [`& ${scriptFile.fileToCommandArgument()}`];
        } else if (targetShell === TerminalShellType.commandPrompt && scriptFile.endsWith('Activate.ps1')) {
            // lets not try to run the powershell file from command prompt (user may not have powershell)
            return [];
        } else {
            return;
        }
    }
}
