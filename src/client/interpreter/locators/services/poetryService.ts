// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { IConfigurationService, ICurrentProcess } from '../../../common/types';
import { Interpreters } from '../../../common/utils/localize';
import { StopWatch } from '../../../common/utils/stopWatch';
import { IServiceContainer } from '../../../ioc/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import {
    GetInterpreterLocatorOptions,
    IInterpreterHelper,
    InterpreterType,
    IPoetryService,
    PythonInterpreter
} from '../../contracts';
import { traceProcessError } from '../helpers';
import { IPipEnvServiceHelper } from '../types';
import { CacheableLocatorService } from './cacheableLocatorService';

@injectable()
export class PoetryService extends CacheableLocatorService implements IPoetryService {
    private readonly helper: IInterpreterHelper;
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly workspace: IWorkspaceService;
    private readonly fs: IFileSystem;
    private readonly configService: IConfigurationService;
    private readonly poetryServiceHelper: IPipEnvServiceHelper;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('PoetryService', serviceContainer, true);
        this.helper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.processServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.poetryServiceHelper = this.serviceContainer.get<IPipEnvServiceHelper>(IPipEnvServiceHelper);
    }

    // tslint:disable-next-line:no-empty
    public dispose() {}

    public async isRelatedPoetryEnvironment(dir: string, pythonPath: string): Promise<boolean> {
        if (!this.didTriggerInterpreterSuggestions) {
            return false;
        }

        // In PipEnv, the name of the cwd is used as a prefix in the virtual env.
        if (pythonPath.indexOf(`${path.sep}${path.basename(dir)}-`) === -1) {
            return false;
        }
        const envName = await this.getInterpreterPathFromPoetry(dir, true);
        return !!envName;
    }

    public get executable(): string {
        return this.didTriggerInterpreterSuggestions ? this.configService.getSettings().poetryPath : '';
    }

    public async getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonInterpreter[]> {
        if (!this.didTriggerInterpreterSuggestions) {
            return [];
        }

        const stopwatch = new StopWatch();
        const startDiscoveryTime = stopwatch.elapsedTime;

        const interpreters = await super.getInterpreters(resource, options);

        const discoveryDuration = stopwatch.elapsedTime - startDiscoveryTime;
        sendTelemetryEvent(EventName.POETRY_INTERPRETER_DISCOVERY, discoveryDuration);

        return interpreters;
    }

    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        if (!this.didTriggerInterpreterSuggestions) {
            return Promise.resolve([]);
        }

        const poetryCwd = this.getPoetryWorkingDirectory(resource);
        if (!poetryCwd) {
            return Promise.resolve([]);
        }

        return this.getInterpreterFromPoetry(poetryCwd)
            .then((item) => (item ? [item] : []))
            .catch(() => []);
    }

    private async getInterpreterFromPoetry(poetryCwd: string): Promise<PythonInterpreter | undefined> {
        const interpreterPath = await this.getInterpreterPathFromPoetry(poetryCwd);
        if (!interpreterPath) {
            return;
        }

        const details = await this.helper.getInterpreterInformation(interpreterPath);
        if (!details) {
            return;
        }
        this._hasInterpreters.resolve(true);
        await this.poetryServiceHelper.trackWorkspaceFolder(interpreterPath, Uri.file(poetryCwd));
        return {
            ...(details as PythonInterpreter),
            path: interpreterPath,
            type: InterpreterType.Poetry,
            poetryWorkspaceFolder: poetryCwd
        };
    }

    private getPoetryWorkingDirectory(resource?: Uri): string | undefined {
        // The file is not in a workspace. However, workspace may be opened
        // and file is just a random file opened from elsewhere. In this case
        // we still want to provide interpreter associated with the workspace.
        // Otherwise if user tries and formats the file, we may end up using
        // plain pip module installer to bring in the formatter and it is wrong.
        const wsFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        return wsFolder ? wsFolder.uri.fsPath : this.workspace.rootPath;
    }

    private async getInterpreterPathFromPoetry(cwd: string, ignoreErrors = false): Promise<string | undefined> {
        // Quick check before actually running poetry
        if (!(await this.checkIfPoetryFileExists(cwd))) {
            return;
        }
        try {
            // call poetry --help just to see if poetryWorkspaceFolder?: string; is in the PATH
            const version = await this.invokePoetry(['--help'], cwd);
            if (version === undefined) {
                const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
                appShell.showWarningMessage(Interpreters.poetryBinaryMissing().format(this.executable));
                return;
            }
            // env info -p will be empty if a virtualenv has not been created yet
            const venv = await this.invokePoetry(['env', 'info', '-p'], cwd);
            if (venv === '') {
                const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
                appShell.showWarningMessage(Interpreters.poetryVenvMissing());
                return;
            }
            const pythonPath = `${venv}/bin/python`;
            return pythonPath && (await this.fs.fileExists(pythonPath)) ? pythonPath : undefined;
            // tslint:disable-next-line:no-empty
        } catch (error) {
            traceError('Poetry identification failed', error);
            if (ignoreErrors) {
                return;
            }
        }
    }

    private async checkIfPoetryFileExists(cwd: string): Promise<boolean> {
        if (await this.fs.fileExists(path.join(cwd, 'pyproject.toml'))) {
            return true;
        }
        return false;
    }

    private async invokePoetry(arg: string[], rootPath: string): Promise<string | undefined> {
        try {
            const processService = await this.processServiceFactory.create(Uri.file(rootPath));
            const execName = this.executable;
            const result = await processService.exec(execName, arg, { cwd: rootPath });
            if (result) {
                return result.stdout ? result.stdout.trim() : '';
            }
            // tslint:disable-next-line:no-empty
        } catch (error) {
            const platformService = this.serviceContainer.get<IPlatformService>(IPlatformService);
            const currentProc = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
            traceProcessError(platformService, currentProc, error, 'Poetry');
        }
    }
}
