// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { PipEnvInstaller } from '../../../common/installer/pipEnvInstaller';
import { IModuleInstaller } from '../../../common/installer/types';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessService } from '../../../common/process/types';
import { IServiceContainer } from '../../../ioc/types';
import { IPipEnvService } from '../../contracts';

@injectable()
export class PipEnvService implements IPipEnvService {
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
                const result = await this.process.exec('pipenv', ['--venv'], { cwd: path.dirname(resource.fsPath) });
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
}
