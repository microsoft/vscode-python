// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ErrorUtils } from '../../client/common/errors/errorUtils';
import { ModuleNotInstalledError } from '../../client/common/errors/moduleNotInstalledError';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { ExecutionResult, InterpreterInfomation, IPythonExecutionService, ObservableExecutionResult, SpawnOptions } from '../../client/common/process/types';

export class MockPythonExecutionService implements IPythonExecutionService {

    private procService : ProcessService;
    private pythonPath : string = 'python';

    constructor() {
        this.procService = new ProcessService(new BufferDecoder());
    }
    public getInterpreterInformation(): Promise<InterpreterInfomation> {
        throw new Error('Method not implemented.');
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
