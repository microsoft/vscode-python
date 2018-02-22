// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { Architecture, IFileSystem } from '../../../common/platform/types';
import { IProcessService } from '../../../common/process/types';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType } from '../../contracts';

const execName = 'pipenv';

@injectable()
export class PipEnvService implements IInterpreterLocatorService {
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

    private async getInterpreterPath(resource?: Uri): Promise<string | undefined> {
        // The file is not in a workspace. However, workspace may be opened
        // and file is just a random file opened from elsewhere. In this case
        // we still want to provide interpreter associated with the workspace.
        // Otherwise if user tries and formats the file, we may end up using
        // plain pip module installer to bring in the formatter and it is wrong.
        const wsFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const rootPath = wsFolder ? wsFolder.uri.fsPath : this.workspace.rootPath;
        if (!rootPath) {
            return;
        }
        // Quick check before actually running the process
        if (!await this.fs.fileExistsAsync(path.join(rootPath, 'pipfile'))) {
            return;
        }
        const venvFolder = await this.invokePipenv('--venv', rootPath);
        return venvFolder && await this.fs.directoryExistsAsync(venvFolder) ? path.join(venvFolder, 'bin', 'python') : undefined;
    }

    private async invokePipenv(arg: string, rootPath: string): Promise<string | undefined> {
        try {
            const result = await this.process.exec(execName, [arg], { cwd: rootPath });
            if (result && result.stdout) {
                return result.stdout.trim();
            }
            // tslint:disable-next-line:no-empty
        } catch { }
    }
}
