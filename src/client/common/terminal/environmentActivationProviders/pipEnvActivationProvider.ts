// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import '../../../common/extensions';
import {
    IInterpreterLocatorService,
    IInterpreterService,
    IPipEnvService,
    PIPENV_SERVICE,
} from '../../../interpreter/contracts';
import { EnvironmentType } from '../../../pythonEnvironments/info';
import { IWorkspaceService } from '../../application/types';
import { IFileSystem } from '../../platform/types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

@injectable()
export class PipEnvActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterLocatorService)
        @named(PIPENV_SERVICE)
        private readonly pipenvService: IPipEnvService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private readonly fs: IFileSystem,
    ) {}

    public isShellSupported(_targetShell: TerminalShellType): boolean {
        return false;
    }

    public async getActivationCommands(resource: Uri | undefined, _: TerminalShellType): Promise<string[] | undefined> {
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (!interpreter || interpreter.envType !== EnvironmentType.Pipenv) {
            return;
        }
        // Activate using `pipenv shell` only if the current folder relates pipenv environment.
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        if (
            workspaceFolder &&
            interpreter.pipEnvWorkspaceFolder &&
            !this.fs.arePathsSame(workspaceFolder.uri.fsPath, interpreter.pipEnvWorkspaceFolder)
        ) {
            return;
        }
        const execName = this.pipenvService.executable;
        return [`${execName.fileToCommandArgument()} shell`];
    }

    public async getActivationCommandsForInterpreter(
        pythonPath: string,
        _targetShell: TerminalShellType,
    ): Promise<string[] | undefined> {
        const interpreter = await this.interpreterService.getInterpreterDetails(pythonPath);
        if (!interpreter || interpreter.envType !== EnvironmentType.Pipenv) {
            return;
        }

        const execName = this.pipenvService.executable;
        return [`${execName.fileToCommandArgument()} shell`];
    }
}
