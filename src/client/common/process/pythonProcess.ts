// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { IInterpreterVersionService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ErrorUtils } from '../errors/errorUtils';
import { ModuleNotInstalledError } from '../errors/moduleNotInstalledError';
import { IFileSystem } from '../platform/types';
import { IConfigurationService } from '../types';
import { EnvironmentVariables } from '../variables/types';
import { ExecutionResult, IProcessService, IPythonExecutionService, ObservableExecutionResult, SpawnOptions } from './types';

@injectable()
export class PythonExecutionService implements IPythonExecutionService {
    private readonly procService: IProcessService;
    private readonly configService: IConfigurationService;
    private readonly fileSystem: IFileSystem;

    constructor(private serviceContainer: IServiceContainer, private envVars: EnvironmentVariables | undefined, private resource?: Uri) {
        this.procService = serviceContainer.get<IProcessService>(IProcessService);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public async getVersion(): Promise<string> {
        const versionService = this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        return versionService.getVersion(this.pythonPath, '');
    }
    public async getExecutablePath(): Promise<string> {
        // If we've passed the python file, then return the file.
        // This is because on mac if using the interpreter /usr/bin/python2.7 we can get a different value for the path
        if (await this.fileSystem.fileExistsAsync(this.pythonPath)) {
            return this.pythonPath;
        }
        return this.procService.exec(this.pythonPath, ['-c', 'import sys;print(sys.executable)'], { env: this.envVars, throwOnStdErr: true })
            .then(output => output.stdout.trim());
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        return this.procService.exec(this.pythonPath, ['-c', `import ${moduleName}`], { env: this.envVars, throwOnStdErr: true })
            .then(() => true).catch(() => false);
    }

    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        if (this.envVars) {
            opts.env = this.envVars;
        }
        return this.procService.execObservable(this.pythonPath, args, opts);
    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        if (this.envVars) {
            opts.env = this.envVars;
        }
        return this.procService.execObservable(this.pythonPath, ['-m', moduleName, ...args], opts);
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        if (this.envVars) {
            opts.env = this.envVars;
        }
        return this.procService.exec(this.pythonPath, args, opts);
    }
    public async execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        if (this.envVars) {
            opts.env = this.envVars;
        }
        const result = await this.procService.exec(this.pythonPath, ['-m', moduleName, ...args], opts);

        // If a module is not installed we'll have something in stderr.
        if (moduleName && ErrorUtils.outputHasModuleNotInstalledError(moduleName!, result.stderr)) {
            const isInstalled = await this.isModuleInstalled(moduleName!);
            if (!isInstalled) {
                throw new ModuleNotInstalledError(moduleName!);
            }
        }

        return result;
    }
    private get pythonPath(): string {
        return this.configService.getSettings(this.resource).pythonPath;
    }
}
