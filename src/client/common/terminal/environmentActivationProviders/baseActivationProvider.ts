// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { IFileSystem } from '../../platform/types';
import { IConfigurationService } from '../../types';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../types';

@injectable()
export abstract class BaseActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(protected readonly serviceContainer: IServiceContainer) { }

    public abstract isShellSupported(targetShell: TerminalShellType): boolean;
    public abstract getActivationCommands(resource: Uri | undefined, targetShell: TerminalShellType): Promise<string[] | undefined>;

    protected async findScriptFile(resource: Uri | undefined, scriptFileNames: string[]): Promise<string | undefined> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const pythonPath = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(resource).pythonPath;

        for (const scriptFileName of scriptFileNames) {
            // Generate scripts are found in the same directory as the interpreter.
            const scriptFile = path.join(path.dirname(pythonPath), scriptFileName);
            const found = await fs.fileExists(scriptFile);
            if (found) {
                return scriptFile;
            }
        }
    }
}
