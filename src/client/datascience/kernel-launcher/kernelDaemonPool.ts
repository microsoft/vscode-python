// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { IDisposable, Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { KernelLauncherDaemonModule } from '../constants';
import { IJupyterKernelSpec, IKernelDependencyService } from '../types';
import { PythonKernelDaemon } from './kernelDaemon';
import { IPythonKernelDaemon } from './types';

type IKernelDaemonInfo = {
    key: string;
    workspaceResource: Resource;
    workspaceFolderIdentifier: string;
    interpreterPath: string;
    daemon: Promise<IPythonKernelDaemon>;
};

@injectable()
export class KernelDaemonPool implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    private daemonPool: IKernelDaemonInfo[] = [];
    private initialized?: boolean;

    public get daemons() {
        return this.daemonPool.length;
    }

    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IEnvironmentVariablesProvider) private readonly envVars: IEnvironmentVariablesProvider,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IInterpreterService) private readonly interrpeterService: IInterpreterService,
        @inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IKernelDependencyService) private readonly kernelDependencyService: IKernelDependencyService
    ) {}
    public async preWarmKernelDaemons() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.envVars.onDidEnvironmentVariablesChange(this.onDidEnvironmentVariablesChange.bind(this));
        this.interrpeterService.onDidChangeInterpreter(this.onDidChangeInterpreter.bind(this));
        const promises: Promise<void>[] = [];
        if (this.workspaceService.hasWorkspaceFolders) {
            promises.push(
                ...(this.workspaceService.workspaceFolders || []).map((item) => this.preWarmKernelDaemon(item.uri))
            );
        } else {
            promises.push(this.preWarmKernelDaemon(undefined));
        }
        await Promise.all(promises);
    }
    public dispose() {
        this.disposables.forEach((item) => item.dispose());
    }
    public async get(
        resource: Resource,
        kernelSpec: IJupyterKernelSpec,
        interpreter?: PythonInterpreter
    ): Promise<IPythonKernelDaemon> {
        const pythonPath = interpreter?.path || kernelSpec.argv[0];
        // If we have environment variables in the kernel.json, then its not we support.
        // Cuz there's no way to know before hand what kernelspec can be used, hence no way to know what envs are required.
        if (kernelSpec.env && Object.keys(kernelSpec.env).length > 0) {
            return this.createDaemon(resource, pythonPath);
        }

        const key = this.getDaemonKey(resource, pythonPath);
        const index = this.daemonPool.findIndex((item) => item.key === key);
        try {
            if (index >= 0) {
                const daemon = this.daemonPool[index].daemon;
                this.daemonPool.splice(index, 1);
                return daemon;
            }
            return this.createDaemon(resource, pythonPath);
        } finally {
            // If we removed a daemon from the pool, rehydrate it.
            if (index >= 0) {
                this.preWarmKernelDaemon(resource).ignoreErrors();
            }
        }
    }

    private getDaemonKey(resource: Resource, pythonPath: string): string {
        return `${this.workspaceService.getWorkspaceFolderIdentifier(resource)}#${pythonPath}`;
    }
    private createDaemon(resource: Resource, pythonPath: string) {
        const daemon = this.pythonExecutionFactory.createDaemon<IPythonKernelDaemon>({
            daemonModule: KernelLauncherDaemonModule,
            pythonPath,
            daemonClass: PythonKernelDaemon,
            dedicated: true,
            resource
        });
        daemon.then((d) => this.disposables.push(d)).catch(noop);
        return daemon;
    }
    private async onDidEnvironmentVariablesChange(affectedResoruce: Resource) {
        const workspaceFolderIdentifier = this.workspaceService.getWorkspaceFolderIdentifier(affectedResoruce);
        this.daemonPool = this.daemonPool.filter((item) => {
            if (item.workspaceFolderIdentifier === workspaceFolderIdentifier) {
                item.daemon.then((d) => d.dispose()).catch(noop);
                return false;
            }
            return true;
        });
    }
    private async preWarmKernelDaemon(resource: Resource) {
        const interpreter = await this.interrpeterService.getActiveInterpreter(resource);
        if (!interpreter || !(await this.kernelDependencyService.areDependenciesInstalled(interpreter))) {
            return;
        }
        const key = this.getDaemonKey(resource, interpreter.path);
        // If we have already created one in the interim, then get out.
        if (this.daemonPool.some((item) => item.key === key)) {
            return;
        }

        const workspaceFolderIdentifier = this.workspaceService.getWorkspaceFolderIdentifier(resource);
        const daemon = this.createDaemon(resource, interpreter.path);
        // Once a daemon is created ensure we pre-warm it (will load ipykernel and start the kernker process waiting to start the actual kernel code).
        // I.e. we'll start python process thats the kernel, but will not start the kernel module (`python -m ipykernel`).
        daemon.then((d) => d.preWarm()).catch(traceError.bind(`Failed to prewarm kernel daemon ${interpreter.path}`));
        this.daemonPool.push({
            daemon,
            interpreterPath: interpreter.path,
            key,
            workspaceFolderIdentifier,
            workspaceResource: resource
        });
    }
    private async onDidChangeInterpreter() {
        // Get a list of all unique workspaces
        const uniqueResourcesWithKernels = new Map<string, IKernelDaemonInfo>();
        this.daemonPool.forEach((item) => {
            uniqueResourcesWithKernels.set(item.workspaceFolderIdentifier, item);
        });

        // Key = workspace identifier, and value is interpreter path.
        const currentInterpreterInEachWorksapce = new Map<string, string>();
        // Get interpreters for each workspace.
        await Promise.all(
            Array.from(uniqueResourcesWithKernels.entries()).map(async (item) => {
                const resource = item[1].workspaceResource;
                try {
                    const interpreter = await this.interrpeterService.getActiveInterpreter(resource);
                    if (!interpreter) {
                        return;
                    }
                    currentInterpreterInEachWorksapce.set(item[1].key, interpreter.path);
                } catch (ex) {
                    traceError(`Failed to get interpreter information for workspace ${resource?.fsPath}`);
                }
            })
        );

        // Go through all interpreters for each workspace.
        // If we have a daemon with an interpreter thats not the same as the current interpreter for that workspace
        // then kill that daemon, as its no longer valid.
        this.daemonPool = this.daemonPool.filter((item) => {
            const interpreterForWorkspace = currentInterpreterInEachWorksapce.get(item.key);
            if (!interpreterForWorkspace || !this.fs.arePathsSame(interpreterForWorkspace, item.interpreterPath)) {
                item.daemon.then((d) => d.dispose()).catch(noop);
                return false;
            }

            return true;
        });
    }
}
