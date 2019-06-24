// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { SemVer } from 'semver';
import { IWorkspaceService } from '../../client/common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { ErrorUtils } from '../../client/common/errors/errorUtils';
import { ModuleNotInstalledError } from '../../client/common/errors/moduleNotInstalledError';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import {
    ExecutionResult,
    InterpreterInfomation,
    IPythonExecutionService,
    ObservableExecutionResult,
    SpawnOptions
} from '../../client/common/process/types';
import { IOutputChannel } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { IServiceContainer } from '../../client/ioc/types';

export class MockPythonExecutionService implements IPythonExecutionService {

    private procService : ProcessService;
    private pythonPath : string = 'python';

    constructor(serviceContainer: IServiceContainer) {
        const output = serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.procService = new ProcessService(new BufferDecoder(), output, workspaceService);
    }
    public getInterpreterInformation(): Promise<InterpreterInfomation> {
        return Promise.resolve(
            {
                path: '',
                version: new SemVer('3.6.0-beta'),
                sysVersion: '1.0',
                sysPrefix: '1.0',
                architecture: Architecture.x64
            });
    }

    public getExecutablePath(): Promise<string> {
        return Promise.resolve(this.pythonPath);
    }
    public isModuleInstalled(moduleName: string): Promise<boolean> {
        return this.procService.exec(this.pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true })
            .then(() => true).catch(() => false);
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        return this.procService.execObservable(this.pythonPath, args, opts);
    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        return this.procService.execObservable(this.pythonPath, ['-m', moduleName, ...args], opts);
    }
    public exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        return this.procService.exec(this.pythonPath, args, opts);
    }
    public async execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
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
}
