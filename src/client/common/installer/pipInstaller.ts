// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { IPythonExecutionFactory } from '../process/types';
import { ExecutionInfo } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller } from './moduleInstaller';
import { InterpreterUri } from './types';

@injectable()
export class PipInstaller extends ModuleInstaller {
    public get name(): string {
        return 'Pip';
    }

    public get displayName() {
        return 'Pip';
    }
    public get priority(): number {
        return 0;
    }
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public isSupported(resource?: InterpreterUri): Promise<boolean> {
        return this.isPipAvailable(resource);
    }
    protected async getExecutionInfo(moduleName: string, _resource?: InterpreterUri): Promise<ExecutionInfo> {
        const proxyArgs: string[] = [];
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const proxy = workspaceService.getConfiguration('http').get('proxy', '');
        if (proxy.length > 0) {
            proxyArgs.push('--proxy');
            proxyArgs.push(proxy);
        }
        return {
            args: [...proxyArgs, 'install', '-U', moduleName],
            moduleName: 'pip'
        };
    }
    private isPipAvailable(info?: InterpreterUri): Promise<boolean> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const resource = isResource(info) ? info : undefined;
        const pythonPath = isResource(info) ? undefined : info.path;
        return pythonExecutionFactory
            .create({ resource, pythonPath })
            .then((proc) => proc.isModuleInstalled('pip'))
            .catch(() => false);
    }
}
