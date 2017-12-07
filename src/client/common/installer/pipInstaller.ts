// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import 'reflect-metadata';
import { Uri, workspace } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IPythonExecutionFactory } from '../process/types';
import { ExecutionInfo } from '../types';
import { ModuleInstaller } from './moduleInstaller';

@injectable()
export class PipInstaller extends ModuleInstaller {
    private isCondaAvailable: boolean | undefined;
    constructor( @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('Pip', serviceContainer);
    }
    public isSupported(resource?: Uri): Promise<boolean> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        return pythonExecutionFactory.create(resource)
            .then(proc => proc.isModuleInstalled('pip'))
            .catch(() => false);
    }
    protected getExecutionInfo(moduleName: string, resource?: Uri): ExecutionInfo {
        const proxyArgs = [];
        const proxy = workspace.getConfiguration('http').get('proxy', '');
        if (proxy.length > 0) {
            proxyArgs.push('--proxy');
            proxyArgs.push(proxy);
        }
        return {
            args: ['pip', ...proxyArgs, 'install', '-U', moduleName],
            execPath: '',
            moduleName: 'pip'
        };
    }
    private isPipAvailable(resource?: Uri) {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        return pythonExecutionFactory.create(resource)
            .then(proc => proc.isModuleInstalled('pip'))
            .catch(() => false);
    }
}
