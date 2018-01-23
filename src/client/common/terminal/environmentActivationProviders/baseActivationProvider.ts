// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { IFileSystem } from '../../platform/types';
import { TerminalShellType } from '../types';
import { ITerminalActivationCommandProvider } from '../types';

@injectable()
export abstract class BaseActivationCommandProvider implements ITerminalActivationCommandProvider {
    constructor(protected readonly serviceContainer: IServiceContainer) { }

    public abstract isShellSupported(targetShell: TerminalShellType): boolean;
    public abstract getActivationCommands(interpreter: PythonInterpreter, targetShell: TerminalShellType): Promise<string[] | undefined>;

    protected async findScriptFile(interpreter: PythonInterpreter, scriptFileNames: string[]): Promise<string | undefined> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);

        for (const scriptFileName of scriptFileNames) {
            // Generate scripts are found in the same directory as the interpreter.
            const scriptFile = path.join(path.dirname(interpreter.path), scriptFileName);
            const found = await fs.fileExistsAsync(scriptFile);
            if (found) {
                return scriptFile;
            }
        }
    }
}
