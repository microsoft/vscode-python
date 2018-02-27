// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../common/application/types';
import { createDeferred, Deferred } from '../../../common/helpers';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessService } from '../../../common/process/types';
import { getPythonExecutable } from '../../../debugger/Common/Utils';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../contracts';

const execName = 'pipenv';
const CACHE_TIMEOUT = 2000;

@injectable()
export class PipEnvService implements IInterpreterLocatorService {
    private readonly versionService: IInterpreterVersionService;
    private readonly process: IProcessService;
    private readonly workspace: IWorkspaceService;
    private readonly fs: IFileSystem;

    private pendingPromises: Deferred<PythonInterpreter[]>[] = [];
    private readonly cachedInterpreters = new Map<string, PythonInterpreter>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.versionService = this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        this.process = this.serviceContainer.get<IProcessService>(IProcessService);
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        const pipenvCwd = this.getPipenvWorkingDirectory(resource);
        if (!pipenvCwd) {
            return Promise.resolve([]);
        }

        // Try cache first
        const interpreter = this.cachedInterpreters[pipenvCwd];
        if (interpreter) {
            return Promise.resolve([interpreter]);
        }
        // We don't want multiple requests executing pipenv
        const deferred = createDeferred<PythonInterpreter[]>();
        this.pendingPromises.push(deferred);
        if (this.pendingPromises.length === 1) {
            // First call, start worker
            this.getInterpreter(pipenvCwd)
                .then(x => this.resolveDeferred(x ? [x] : []))
                .catch(e => this.resolveDeferred([]));
        }
        return deferred.promise;
    }

    public dispose() {
        this.resolveDeferred([]);
    }

    private resolveDeferred(result: PythonInterpreter[]) {
        this.pendingPromises.forEach(p => p.resolve(result));
        this.pendingPromises = [];
    }

    private async getInterpreter(pipenvCwd: string): Promise<PythonInterpreter | undefined> {
        const interpreter = await this.getInterpreterFromPipenv(pipenvCwd);
        if (interpreter) {
            this.cachedInterpreters[pipenvCwd] = interpreter;
            setTimeout(() => this.cachedInterpreters.clear(), CACHE_TIMEOUT);
        }
        return interpreter;
    }

    private async getInterpreterFromPipenv(pipenvCwd: string): Promise<PythonInterpreter | undefined> {
        const interpreterPath = await this.getInterpreterPathFromPipenv(pipenvCwd);
        if (!interpreterPath) {
            return;
        }
        const pythonExecutablePath = getPythonExecutable(interpreterPath);
        const ver = await this.versionService.getVersion(pythonExecutablePath, '');
        return {
            path: pythonExecutablePath,
            displayName: `${ver} (${execName})`,
            type: InterpreterType.VirtualEnv,
            version: ver
        };
    }

    private getPipenvWorkingDirectory(resource?: Uri): string | undefined {
        // The file is not in a workspace. However, workspace may be opened
        // and file is just a random file opened from elsewhere. In this case
        // we still want to provide interpreter associated with the workspace.
        // Otherwise if user tries and formats the file, we may end up using
        // plain pip module installer to bring in the formatter and it is wrong.
        const wsFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        return wsFolder ? wsFolder.uri.fsPath : this.workspace.rootPath;
    }

    private async getInterpreterPathFromPipenv(cwd: string): Promise<string | undefined> {
        // Quick check before actually running pipenv
        if (!await this.fs.fileExistsAsync(path.join(cwd, 'pipfile'))) {
            return;
        }
        const venvFolder = await this.invokePipenv('--venv', cwd);
        return venvFolder && await this.fs.directoryExistsAsync(venvFolder) ? venvFolder : undefined;
    }

    private async invokePipenv(arg: string, rootPath: string): Promise<string | undefined> {
        try {
            const result = await this.process.exec(execName, [arg], { cwd: rootPath });
            if (result && result.stdout) {
                return result.stdout.trim();
            }
            // tslint:disable-next-line:no-empty
        } catch (error) {
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            appShell.showWarningMessage(`Workspace contains pipfile but attempt to run 'pipenv --venv' failed with ${error}. Make sure pipenv is on the PATH.`);
        }
    }
}
