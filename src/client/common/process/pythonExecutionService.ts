// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonExecInfo } from '../../pythonEnvironments/exec';
import { InterpreterInformation } from '../../pythonEnvironments/info';
import { PythonExecutionEnvironment } from './pythonEnvironment';
import { PythonProcessService } from './pythonProcess';
import { ExecutionResult, IPythonExecutionService, ObservableExecutionResult, SpawnOptions } from './types';

// Adding this class here temporarily. The current design of how we execute python
// code in the extension for tools is convoluted and makes it hard to test. Adding
// this class here to make it easier to test.

// TODO: Remove this class (see above comment)

export class PythonExecutionService implements IPythonExecutionService {
    constructor(private readonly env: PythonExecutionEnvironment, private readonly proc: PythonProcessService) {}

    public getInterpreterInformation(): Promise<InterpreterInformation | undefined> {
        return this.env.getInterpreterInformation();
    }

    public getExecutablePath(): Promise<string> {
        return this.env.getExecutablePath();
    }

    public isModuleInstalled(moduleName: string): Promise<boolean> {
        return this.env.isModuleInstalled(moduleName);
    }

    public getModuleVersion(moduleName: string): Promise<string | undefined> {
        return this.env.getModuleVersion(moduleName);
    }

    public getExecutionInfo(pythonArgs?: string[]): PythonExecInfo {
        return this.env.getExecutionInfo(pythonArgs);
    }

    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.proc.execObservable(args, options);
    }

    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions,
    ): ObservableExecutionResult<string> {
        return this.proc.execModuleObservable(moduleName, args, options);
    }

    exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.proc.exec(args, options);
    }

    execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.proc.execModule(moduleName, args, options);
    }
}
