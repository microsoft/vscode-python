// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { ICurrentProcess } from '../../../common/types';
import { IEnvironmentVariablesProvider } from '../../../common/variables/types';
import { getPythonExecutable } from '../../../debugger/Common/Utils';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../contracts';
import { CacheableLocatorService } from './cacheableLocatorService';

const execName = 'pipenv';
const pipEnvFileNameVariable = 'PIPENV_PIPFILE';

@injectable()
export class PipEnvService extends CacheableLocatorService {
    private readonly versionService: IInterpreterVersionService;
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly workspace: IWorkspaceService;
    private readonly fs: IFileSystem;
    private readonly envVarsProvider: IEnvironmentVariablesProvider;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('PipEnvService', serviceContainer);
        this.versionService = this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        this.processServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.envVarsProvider = this.serviceContainer.get<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        const pipenvCwd = this.getPipenvWorkingDirectory(resource);
        if (!pipenvCwd) {
            return Promise.resolve([]);
        }

        return this.getInterpreterFromPipenv(pipenvCwd)
            .then(item => item ? [item] : [])
            .catch(() => []);
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
        if (!await this.checkIfPipFileExists(cwd)) {
            return;
        }
        const venvFolder = await this.invokePipenv('--venv', cwd);
        return venvFolder && await this.fs.directoryExists(venvFolder) ? venvFolder : undefined;
    }
    private async checkIfPipFileExists(cwd: string): Promise<boolean> {
        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const pipFileName = currentProcess.env[pipEnvFileNameVariable];
        if (typeof pipFileName === 'string' && await this.fs.fileExists(path.join(cwd, pipFileName))) {
            return true;
        }
        if (await this.fs.fileExists(path.join(cwd, 'Pipfile'))) {
            return true;
        }
        return false;
    }

    private async invokePipenv(arg: string, rootPath: string): Promise<string | undefined> {
        try {
            const processService = await this.processServiceFactory.create(Uri.file(rootPath));
            const result = await processService.exec(execName, [arg], { cwd: rootPath });
            if (result) {
                const stdout = result.stdout ? result.stdout.trim() : '';
                const stderr = result.stderr ? result.stderr.trim() : '';
                if (stderr.length > 0 && stdout.length === 0) {
                    throw new Error(stderr);
                }
                return stdout;
            }
            // tslint:disable-next-line:no-empty
        } catch (error) {
            console.error(error);
            const errorMessage = error.message || error;
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            appShell.showWarningMessage(`Workspace contains pipfile but attempt to run 'pipenv --venv' failed with '${errorMessage}'. Make sure pipenv is on the PATH.`);
        }
    }
}
