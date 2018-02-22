// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { PipEnvInstaller } from '../../../common/installer/pipEnvInstaller';
import { IModuleInstaller } from '../../../common/installer/types';
import { Architecture, IFileSystem } from '../../../common/platform/types';
import { IProcessService } from '../../../common/process/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType, IPipEnvService } from '../../contracts';

const execName = 'pipenv';

@injectable()
export class PipEnvService implements IPipEnvService, IInterpreterLocatorService {
    private readonly versionService: IInterpreterVersionService;
    private readonly process: IProcessService;
    private readonly workspace: IWorkspaceService;
    private readonly fs: IFileSystem;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.versionService = this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        this.process = this.serviceContainer.get<IProcessService>(IProcessService);
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public async getInterpreterPath(resource?: Uri): Promise<string | undefined> {
        // Quick check before actually running the process
        const wsFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        if (!wsFolder || !await this.fs.fileExistsAsync(path.join(wsFolder.uri.fsPath, 'pipfile'))) {
            return;
        }
        const venvFolder = await this.invokePipenv('--venv', resource);
        return venvFolder && await this.fs.directoryExistsAsync(venvFolder) ? path.join(venvFolder, 'bin', 'python') : undefined;
    }

    public async getInstaller(resource?: Uri): Promise<IModuleInstaller | undefined> {
        if (this.getInterpreterPath(resource)) {
            return new PipEnvInstaller(this.serviceContainer);
        }
    }

    public async getInterpreters(resource?: Uri): Promise<{
        path: string;
        companyDisplayName?: string;
        displayName?: string;
        version?: string;
        architecture?: Architecture;
        type: InterpreterType;
        envName?: string;
        envPath?: string;
        cachedEntry?: boolean;
        realPath?: string;
    }[]> {
        const interpteretPath = await this.getInterpreterPath(resource);
        if (!interpteretPath) {
            return [];
        }
        const ver = await this.versionService.getVersion(interpteretPath, '');
        return [{
            path: interpteretPath,
            displayName: `${ver} (${execName})`,
            type: InterpreterType.VirtualEnv,
            version: ver
        }];
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }

    private getPipEnvCwd(resource?: Uri): string | undefined {
        if (resource) {
            const wsFolder = this.workspace.getWorkspaceFolder(resource);
            return wsFolder ? wsFolder.uri.fsPath : undefined;
        }
    }

    private async invokePipenv(arg: string, resource?: Uri): Promise<string | undefined> {
        const dir = this.getPipEnvCwd(resource);
        if (dir) {
            try {
                const result = await this.process.exec(execName, [arg], { cwd: dir });
                if (result && result.stdout) {
                    return result.stdout.trim();
                }
                // tslint:disable-next-line:no-empty
            } catch { }
        }
    }
}
