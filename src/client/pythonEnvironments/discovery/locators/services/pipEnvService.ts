// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../../common/application/types';
import { traceError, traceWarning } from '../../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../../common/platform/types';
import { IProcessServiceFactory } from '../../../../common/process/types';
import { IConfigurationService, ICurrentProcess } from '../../../../common/types';
import { StopWatch } from '../../../../common/utils/stopWatch';
import { IInterpreterHelper, IPipEnvService } from '../../../../interpreter/contracts';
import { IPipEnvServiceHelper } from '../../../../interpreter/locators/types';
import { IServiceContainer } from '../../../../ioc/types';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { InterpreterType, PythonInterpreter } from '../../../info';
import { GetInterpreterLocatorOptions } from '../types';
import { CacheableLocatorService } from './cacheableLocatorService';

const pipEnvFileNameVariable = 'PIPENV_PIPFILE';

@injectable()
export class PipEnvService extends CacheableLocatorService implements IPipEnvService {
    private readonly helper: IInterpreterHelper;
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly workspace: IWorkspaceService;
    private readonly fs: IFileSystem;
    private readonly configService: IConfigurationService;
    private readonly pipEnvServiceHelper: IPipEnvServiceHelper;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('PipEnvService', serviceContainer, true);
        this.helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.processServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.pipEnvServiceHelper = this.serviceContainer.get<IPipEnvServiceHelper>(IPipEnvServiceHelper);
    }

    // tslint:disable-next-line:no-empty
    public dispose() {}

    public async isRelatedPipEnvironment(dir: string, pythonPath: string): Promise<boolean> {
        if (!this.didTriggerInterpreterSuggestions) {
            return false;
        }

        // In PipEnv, the name of the cwd is used as a prefix in the virtual env.
        if (pythonPath.indexOf(`${path.sep}${path.basename(dir)}-`) === -1) {
            return false;
        }
        const envName = await this.getInterpreterPathFromPipenv(dir, true);
        return !!envName;
    }

    public get executable(): string {
        return this.didTriggerInterpreterSuggestions ? this.configService.getSettings().pipenvPath : '';
    }

    public async getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonInterpreter[]> {
        if (!this.didTriggerInterpreterSuggestions) {
            return [];
        }

        const stopwatch = new StopWatch();
        const startDiscoveryTime = stopwatch.elapsedTime;

        const interpreters = await super.getInterpreters(resource, options);

        const discoveryDuration = stopwatch.elapsedTime - startDiscoveryTime;
        sendTelemetryEvent(EventName.PIPENV_INTERPRETER_DISCOVERY, discoveryDuration);

        return interpreters;
    }

    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        if (!this.didTriggerInterpreterSuggestions) {
            return Promise.resolve([]);
        }

        const pipenvCwd = this.getPipenvWorkingDirectory(resource);
        if (!pipenvCwd) {
            return Promise.resolve([]);
        }

        return this.getInterpreterFromPipenv(pipenvCwd)
            .then((item) => (item ? [item] : []))
            .catch(() => []);
    }

    private async getInterpreterFromPipenv(pipenvCwd: string): Promise<PythonInterpreter | undefined> {
        const interpreterPath = await this.getInterpreterPathFromPipenv(pipenvCwd);
        if (!interpreterPath) {
            return;
        }

        const details = await this.helper.getInterpreterInformation(interpreterPath);
        if (!details) {
            return;
        }
        this._hasInterpreters.resolve(true);
        await this.pipEnvServiceHelper.trackWorkspaceFolder(interpreterPath, Uri.file(pipenvCwd));
        return {
            ...(details as PythonInterpreter),
            path: interpreterPath,
            type: InterpreterType.Pipenv,
            pipEnvWorkspaceFolder: pipenvCwd
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

    private async getInterpreterPathFromPipenv(cwd: string, ignoreErrors = false): Promise<string | undefined> {
        // Quick check before actually running pipenv
        if (!(await this.checkIfPipFileExists(cwd))) {
            return;
        }
        try {
            // call pipenv --version just to see if pipenv is in the PATH
            const version = await this.invokePipenv('--version', cwd);
            if (version === undefined) {
                const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
                appShell.showWarningMessage(
                    `Workspace contains Pipfile but '${this.executable}' was not found. Make sure '${this.executable}' is on the PATH.`
                );
                return;
            }
            // The --py command will fail if the virtual environment has not been setup yet.
            // so call pipenv --venv to check for the virtual environment first.
            const venv = await this.invokePipenv('--venv', cwd);
            if (venv === undefined) {
                const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
                appShell.showWarningMessage(
                    'Workspace contains Pipfile but the associated virtual environment has not been setup. Setup the virtual environment manually if needed.'
                );
                return;
            }
            const pythonPath = await this.invokePipenv('--py', cwd);
            return pythonPath && (await this.fs.fileExists(pythonPath)) ? pythonPath : undefined;
            // tslint:disable-next-line:no-empty
        } catch (error) {
            traceError('PipEnv identification failed', error);
            if (ignoreErrors) {
                return;
            }
        }
    }

    private async checkIfPipFileExists(cwd: string): Promise<boolean> {
        const currentProcess = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const pipFileName = currentProcess.env[pipEnvFileNameVariable];
        if (typeof pipFileName === 'string' && (await this.fs.fileExists(path.join(cwd, pipFileName)))) {
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
            const execName = this.executable;
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
            const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
            const currentProc = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
            const enviromentVariableValues: Record<string, string | undefined> = {
                LC_ALL: currentProc.env.LC_ALL,
                LANG: currentProc.env.LANG
            };
            enviromentVariableValues[platformService.pathVariableName] =
                currentProc.env[platformService.pathVariableName];

            traceWarning('Error in invoking PipEnv', error);
            traceWarning(`Relevant Environment Variables ${JSON.stringify(enviromentVariableValues, undefined, 4)}`);
        }
    }
}
