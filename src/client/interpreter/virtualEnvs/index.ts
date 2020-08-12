// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IProcessServiceFactory } from '../../common/process/types';
import { getAllScripts as getNonWindowsScripts } from '../../common/terminal/environmentActivationProviders/bash';
import { getAllScripts as getWindowsScripts } from '../../common/terminal/environmentActivationProviders/commandPrompt';
import { ICurrentProcess, IPathUtils } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import * as globalenvs from '../../pythonEnvironments/discovery/globalenv';
import * as subenvs from '../../pythonEnvironments/discovery/subenv';
import { EnvironmentType } from '../../pythonEnvironments/info';
import { IInterpreterLocatorService, IPipEnvService, PIPENV_SERVICE } from '../contracts';
import { IVirtualEnvironmentManager } from './types';

@injectable()
export class VirtualEnvironmentManager implements IVirtualEnvironmentManager {
    private processServiceFactory: IProcessServiceFactory;
    private pipEnvService: IPipEnvService;
    private fs: IFileSystem;
    private workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.fs = serviceContainer.get<IFileSystem>(IFileSystem);
        this.pipEnvService = serviceContainer.get<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            PIPENV_SERVICE
        ) as IPipEnvService;
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }

    public async getEnvironmentName(pythonPath: string, resource?: Uri): Promise<string> {
        const finders = subenvs.getNameFinders(
            await this.getWorkspaceRoot(resource),
            path.dirname,
            path.basename,
            // We use a closure on "this".
            (d: string, p: string) => this.pipEnvService.isRelatedPipEnvironment(d, p)
        );
        return (await subenvs.getName(pythonPath, finders)) || '';
    }

    public async getEnvironmentType(pythonPath: string, resource?: Uri): Promise<EnvironmentType> {
        const pathUtils = this.serviceContainer.get<IPathUtils>(IPathUtils);
        const plat = this.serviceContainer.get<IPlatformService>(IPlatformService);
        const candidates = plat.isWindows ? getWindowsScripts(path.join) : getNonWindowsScripts();
        const finders = subenvs.getTypeFinders(
            pathUtils.home,
            candidates,
            path.sep,
            path.join,
            path.dirname,
            () => this.getWorkspaceRoot(resource),
            (d: string, p: string) => this.pipEnvService.isRelatedPipEnvironment(d, p),
            (n: string) => {
                const curProc = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
                return curProc.env[n];
            },
            (n: string) => this.fs.fileExists(n),
            async (c: string, a: string[]) => {
                const processService = await this.processServiceFactory.create(resource);
                return processService.exec(c, a);
            }
        );
        return (await subenvs.getType(pythonPath, finders)) || EnvironmentType.Unknown;
    }

    public async isVenvEnvironment(pythonPath: string) {
        const find = subenvs.getVenvTypeFinder(
            path.dirname,
            path.join,
            // We use a closure on "this".
            (n: string) => this.fs.fileExists(n)
        );
        return (await find(pythonPath)) === EnvironmentType.Venv;
    }

    public async isPyEnvEnvironment(pythonPath: string, resource?: Uri) {
        const pathUtils = this.serviceContainer.get<IPathUtils>(IPathUtils);
        const find = globalenvs.getPyenvTypeFinder(
            pathUtils.home,
            path.sep,
            path.join,
            (n: string) => {
                const curProc = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
                return curProc.env[n];
            },
            async (c: string, a: string[]) => {
                const processService = await this.processServiceFactory.create(resource);
                return processService.exec(c, a);
            }
        );
        return (await find(pythonPath)) === EnvironmentType.Pyenv;
    }

    public async isPipEnvironment(pythonPath: string, resource?: Uri) {
        const find = subenvs.getPipenvTypeFinder(
            () => this.getWorkspaceRoot(resource),
            // We use a closure on "this".
            (d: string, p: string) => this.pipEnvService.isRelatedPipEnvironment(d, p)
        );
        return (await find(pythonPath)) === EnvironmentType.Pipenv;
    }

    public async getPyEnvRoot(resource?: Uri): Promise<string | undefined> {
        const pathUtils = this.serviceContainer.get<IPathUtils>(IPathUtils);
        const find = globalenvs.getPyenvRootFinder(
            pathUtils.home,
            path.join,
            (n: string) => {
                const curProc = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
                return curProc.env[n];
            },
            async (c: string, a: string[]) => {
                const processService = await this.processServiceFactory.create(resource);
                return processService.exec(c, a);
            }
        );
        return find();
    }

    public async isVirtualEnvironment(pythonPath: string) {
        const plat = this.serviceContainer.get<IPlatformService>(IPlatformService);
        const candidates = plat.isWindows ? getWindowsScripts(path.join) : getNonWindowsScripts();
        const find = subenvs.getVirtualenvTypeFinder(
            candidates,
            path.dirname,
            path.join,
            // We use a closure on "this".
            (n: string) => this.fs.fileExists(n)
        );
        return (await find(pythonPath)) === EnvironmentType.VirtualEnv;
    }

    private async getWorkspaceRoot(resource?: Uri): Promise<string | undefined> {
        const defaultWorkspaceUri = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders![0].uri
            : undefined;
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const uri = workspaceFolder ? workspaceFolder.uri : defaultWorkspaceUri;
        return uri ? uri.fsPath : undefined;
    }
}
