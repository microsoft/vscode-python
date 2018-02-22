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
import { IInterpreterLocatorService, InterpreterType, IPipEnvService } from '../../contracts';

const execName = 'pipenv';

@injectable()
export class PipEnvService implements IPipEnvService, IInterpreterLocatorService {
    private readonly process: IProcessService;
    private readonly workspace: IWorkspaceService;
    private readonly fs: IFileSystem;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.process = this.serviceContainer.get<IProcessService>(IProcessService);
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public async getInterpreterPath(resource?: Uri): Promise<string | undefined> {
        if (!resource) {
            const workspaceFolders = this.workspace.workspaceFolders;
            if (Array.isArray(workspaceFolders)) {
                resource = workspaceFolders[0].uri;
            }
        }
        if (resource) {
            try {
                const result = await this.process.exec(execName, ['--venv'], { cwd: this.getPipEnvCwd(resource) });
                return result.stdout && await this.fs.directoryExistsAsync(result.stdout) ? result.stdout : undefined;
                // tslint:disable-next-line:no-empty
            } catch { }
        }
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
        return [{
            path: interpteretPath,
            displayName: execName,
            type: InterpreterType.VirtualEnv,
            version: await this.getPythonVersion(resource)
        }];
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }

    private async getPythonVersion(resource?: Uri): Promise<string | undefined> {
        try {
            const result = await this.process.exec(execName, ['--where'], { cwd: this.getPipEnvCwd(resource) });
            const root = result.stdout && await this.fs.directoryExistsAsync(result.stdout) ? result.stdout : undefined;
            if (root) {
                const content = await this.fs.readFile(path.join(root, 'pipfile'));
                const matches = content.match(/^python_version[ |\t]*=[ |\t]"\d*.\d*"/g);
                if (matches && matches.entries && matches.entries.length > 0) {
                    return matches.entries[0].match(/\d*.\d*/);
                }
            }
            // tslint:disable-next-line:no-empty
        } catch { }
    }

    private getPipEnvCwd(resource?: Uri): string | undefined {
        if (!resource) {
            const workspaceFolders = this.workspace.workspaceFolders;
            if (Array.isArray(workspaceFolders)) {
                resource = workspaceFolders[0].uri;
            }
        }
        return resource ? path.dirname(resource.fsPath) : undefined;
    }
}
