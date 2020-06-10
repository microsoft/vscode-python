// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../../ioc/types';
import { findVenvExecutable } from '../../../pythonEnvironments/discovery/subenv';
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
}

export type ActivationScripts = Record<TerminalShellType, string[]>;

export abstract class VenvBaseActivationCommandProvider extends BaseActivationCommandProvider {
    constructor(
        protected readonly scripts: ActivationScripts,
        // This is passed through.
        serviceContainer: IServiceContainer
    ) {
        super(serviceContainer);
    }

    public isShellSupported(targetShell: TerminalShellType): boolean {
        return this.scripts[targetShell] !== undefined;
    }

    protected async findScriptFile(pythonPath: string, targetShell: TerminalShellType): Promise<string | undefined> {
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const candidates = this.scripts[targetShell];
        return findVenvExecutable(pythonPath, candidates || [], path, (n: string) => fs.fileExists(n));
    }
}
