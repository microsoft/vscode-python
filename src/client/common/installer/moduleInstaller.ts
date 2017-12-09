// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import 'reflect-metadata';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { PythonSettings } from '../configSettings';
import { ITerminalService } from '../terminal/types';
import { ExecutionInfo } from '../types';

@injectable()
export abstract class ModuleInstaller {
    constructor(protected serviceContainer: IServiceContainer) { }
    public async installModule(name: string, resource?: Uri): Promise<void> {
        const executionInfo = await this.getExecutionInfo(name, resource);
        const terminalService = this.serviceContainer.get<ITerminalService>(ITerminalService);

        if (executionInfo.moduleName) {
            const pythonPath = PythonSettings.getInstance(resource).pythonPath;
            await terminalService.sendCommand(pythonPath, ['-m', 'pip'].concat(executionInfo.args));
        } else {
            await terminalService.sendCommand(executionInfo.execPath!, executionInfo.args);
        }
    }
    public abstract isSupported(resource?: Uri): Promise<boolean>;
    protected abstract getExecutionInfo(moduleName: string, resource?: Uri): Promise<ExecutionInfo>;
}
