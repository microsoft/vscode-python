// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { ITerminalService } from '../terminal/types';
import { ExecutionInfo } from '../types';
import { IModuleInstaller } from './types';

export abstract class ModuleInstaller implements IModuleInstaller {
    constructor(public readonly displayName, protected serviceContainer: IServiceContainer) {
    }
    public async installModule(name: string, resource?: Uri): Promise<void> {
        const executionInfo = this.getExecutionInfo(name, resource);
        const terminalService = this.serviceContainer.get<ITerminalService>(ITerminalService);
        const executable = executionInfo.moduleName ? executionInfo.moduleName! : executionInfo.execPath!;
        terminalService.sendCommand(executable, executionInfo.args);
    }
    public abstract isSupported(resource?: Uri): Promise<boolean>;
    protected abstract getExecutionInfo(moduleName: string, resource?: Uri): ExecutionInfo;
}
