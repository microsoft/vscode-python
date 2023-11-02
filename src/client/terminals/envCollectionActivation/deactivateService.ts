/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { sleep, waitForCondition } from '../../../test/common';
import { ITerminalManager } from '../../common/application/types';
import { pathExists } from '../../common/platform/fs-paths';
import { _SCRIPTS_DIR } from '../../common/process/internal/scripts/constants';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { cache } from '../../common/utils/decorators';
import { StopWatch } from '../../common/utils/stopWatch';
import { IInterpreterService } from '../../interpreter/contracts';
import { virtualEnvTypes } from '../../pythonEnvironments/info';
import { ITerminalDeactivateService } from '../types';

@injectable()
export class TerminalDeactivateService implements ITerminalDeactivateService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private readonly envVarScript = path.join(_SCRIPTS_DIR, 'printEnvVariablesToFile.py');

    private readonly printenvVarScript = path.join(_SCRIPTS_DIR, 'printEnvVariables.py');

    constructor(
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
    ) {}

    @cache(-1, true)
    public async getTerminalProcessVariables(shell: string): Promise<void> {
        const shellType = identifyShellFromShellPath(shell);
        const terminal = this.terminalManager.createTerminal({
            name: `Python ${shellType} Deactivate`,
            shellPath: shell,
            hideFromUser: true,
            cwd: _SCRIPTS_DIR,
        });
        sleep(3000).then(() => terminal.show());
        const globalInterpreters = this.interpreterService
            .getInterpreters()
            .filter((i) => !virtualEnvTypes.includes(i.envType));
        const outputFile = path.join(_SCRIPTS_DIR, `envVars_${shellType}.json`);
        const interpreterPath =
            globalInterpreters.length > 0 && globalInterpreters[0] ? globalInterpreters[0].path : 'python';
        const checkIfFileHasBeenCreated = () => pathExists(outputFile);
        terminal.sendText(`${interpreterPath} "${this.envVarScript}" "${outputFile}"`);
        terminal.sendText(`${interpreterPath} "${this.printenvVarScript}"`);
        const s = new StopWatch();
        await waitForCondition(checkIfFileHasBeenCreated, 30_000, `"${outputFile}" file not created`);
        console.log('great', s.elapsedTime);
    }

    public getDeactivateScriptLocation(_shell: string): string {
        return path.join(_SCRIPTS_DIR);
    }
}
