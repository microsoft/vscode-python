// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { ModuleInstallerType } from '../../pythonEnvironments/info';
import { IWorkspaceService } from '../application/types';
import { IPythonExecutionFactory } from '../process/types';
import { ExecutionInfo, Product } from '../types';
import { isResource } from '../utils/misc';
import { ModuleInstaller, translateProductToModule } from './moduleInstaller';
import { InterpreterUri, ModuleInstallFlags } from './types';

@injectable()
export class PipInstaller extends ModuleInstaller {
    public get name(): string {
        return 'Pip';
    }

    public get type(): ModuleInstallerType {
        return ModuleInstallerType.Pip;
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
    protected async getExecutionInfo(
        moduleName: string,
        _resource?: InterpreterUri,
        flags: ModuleInstallFlags = 0,
    ): Promise<ExecutionInfo> {
        if (moduleName === translateProductToModule(Product.pip)) {
            return {
                args: [],
                moduleName: 'ensurepip',
            };
        }

        const args: string[] = [];
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const proxy = workspaceService.getConfiguration('http').get('proxy', '');
        if (proxy.length > 0) {
            args.push('--proxy');
            args.push(proxy);
        }
        args.push(...['install', '-U']);
        if (flags & ModuleInstallFlags.reInstall) {
            args.push('--force-reinstall');
        }
        return {
            args: [...args, moduleName],
            moduleName: 'pip',
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
