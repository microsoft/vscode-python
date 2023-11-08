/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { waitForCondition } from '../../../test/common';
import { ITerminalManager } from '../../common/application/types';
import { pathExists } from '../../common/platform/fs-paths';
import { _SCRIPTS_DIR } from '../../common/process/internal/scripts/constants';
import { identifyShellFromShellPath } from '../../common/terminal/shellDetectors/baseShellDetector';
import { cache } from '../../common/utils/decorators';
import { StopWatch } from '../../common/utils/stopWatch';
import { IInterpreterService } from '../../interpreter/contracts';
import { traceVerbose } from '../../logging';
import { virtualEnvTypes } from '../../pythonEnvironments/info';
import { ITerminalDeactivateService } from '../types';
import { ShellIntegrationShells } from './shellIntegration';

@injectable()
export class TerminalDeactivateService implements ITerminalDeactivateService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private readonly envVarScript = path.join(_SCRIPTS_DIR, 'printEnvVariablesToFile.py');

    constructor(
        @inject(ITerminalManager) private readonly terminalManager: ITerminalManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
    ) {}

    @cache(-1, true)
    public async getTerminalProcessVariables(shell: string): Promise<void> {
        const location = this.getDeactivateScriptLocation(shell);
        if (!location) {
            return;
        }
        const shellType = identifyShellFromShellPath(shell);
        const terminal = this.terminalManager.createTerminal({
            name: `Python ${shellType} Deactivate`,
            shellPath: shell,
            hideFromUser: true,
            cwd: location,
        });
        const globalInterpreters = this.interpreterService.getInterpreters().filter((i) => !i.type);
        const outputFile = path.join(location, `envVars.txt`);
        const interpreterPath =
            globalInterpreters.length > 0 && globalInterpreters[0] ? globalInterpreters[0].path : 'python';
        const checkIfFileHasBeenCreated = () => pathExists(outputFile);
        const stopWatch = new StopWatch();
        terminal.sendText(`${interpreterPath} "${this.envVarScript}" "${outputFile}"`);
        await waitForCondition(checkIfFileHasBeenCreated, 30_000, `"${outputFile}" file not created`);
        traceVerbose(`Time taken to get env vars using terminal is ${stopWatch.elapsedTime}ms`);
    }

    public getDeactivateScriptLocation(shell: string): string | undefined {
        const shellType = identifyShellFromShellPath(shell);
        if (!ShellIntegrationShells.includes(shellType)) {
            return undefined;
        }
        return path.join(_SCRIPTS_DIR, 'deactivate', shellType);
    }
}
