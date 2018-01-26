// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { IServiceContainer } from '../../ioc/types';
import { ErrorUtils } from '../errors/errorUtils';
import { ModuleNotInstalledError } from '../errors/moduleNotInstalledError';
import { IConfigurationService } from '../types';
import { EnvironmentVariables } from '../variables/types';
import { ExecutionResult, IProcessService, IPythonExecutionService, ObservableExecutionResult, SpawnOptions } from './types';

@injectable()
export class PythonExecutionService implements IPythonExecutionService {
    private procService: IProcessService;
    private configService: IConfigurationService;

    constructor(serviceContainer: IServiceContainer, private envVars: EnvironmentVariables | undefined) {
        this.procService = serviceContainer.get<IProcessService>(IProcessService);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }

    public async getVersion(): Promise<string> {
        return this.procService.exec(this.pythonPath, ['--version'], { env: this.envVars, mergeStdOutErr: true })
            .then(output => output.stdout.trim());
    }
    public async getExecutablePath(): Promise<string> {
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
        return this.configService.getSettings().pythonPath;
    }
}
