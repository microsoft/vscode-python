// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { resolveVenvExecutable } from '../../../pythonEnvironments/discovery/subenv';
import { IFileSystem } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

@injectable()
export abstract class BaseActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(protected readonly serviceContainer: IServiceContainer) {}

    public abstract isShellSupported(targetShell: TerminalShellType): boolean;
    public getActivationCommands(
        resource: Uri | undefined,
        targetShell: TerminalShellType
    ): Promise<string[] | undefined> {
        const pythonPath = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource)
            .pythonPath;
        return this.getActivationCommandsForInterpreter(pythonPath, targetShell);
    }
    public abstract getActivationCommandsForInterpreter(
        pythonPath: string,
        targetShell: TerminalShellType
    ): Promise<string[] | undefined>;

    protected async findScriptFile(pythonPath: string, scriptFileNames: string[]): Promise<string | undefined> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        for (const scriptFileName of scriptFileNames) {
            const scriptFile = resolveVenvExecutable(pythonPath, scriptFileName, path);
            if (!scriptFile) {
                return;
            }
            const found = await fs.fileExists(scriptFile);
            if (found) {
                return scriptFile;
            }
        }
    }
}
