// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ErrorUtils } from '../errors/errorUtils';
import { ModuleNotInstalledError } from '../errors/moduleNotInstalledError';
import {
    ExecutionResult,
    IProcessService,
    ObservableExecutionResult,
    PythonExecutionInfo,
    SpawnOptions
} from './types';

interface IPythonEnvironment {
    isModuleInstalled(moduleName: string): Promise<boolean>;
    getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo;
    getExecutionObservableInfo(pythonArgs?: string[]): PythonExecutionInfo;
}

interface IPythonProcessDependencies {
    exec(file: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
    execObservable(file: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string>;
}

class PythonProcessService {
    constructor(
        // These are composed by the caller.
        private readonly env: IPythonEnvironment,
        private readonly deps: IPythonProcessDependencies
    ) {}

    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        const executable = this.env.getExecutionObservableInfo(args);
        return this.deps.execObservable(executable.command, executable.args, opts);
    }

    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        const executable = this.env.getExecutionObservableInfo(['-m', moduleName, ...args]);
        return this.deps.execObservable(executable.command, executable.args, opts);
    }

    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        const executable = this.env.getExecutionInfo(args);
        return this.deps.exec(executable.command, executable.args, opts);
    }

    public async execModule(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        const executable = this.env.getExecutionInfo(['-m', moduleName, ...args]);
        const result = await this.deps.exec(executable.command, executable.args, opts);

        // If a module is not installed we'll have something in stderr.
        if (moduleName && ErrorUtils.outputHasModuleNotInstalledError(moduleName, result.stderr)) {
            const isInstalled = await this.env.isModuleInstalled(moduleName);
            if (!isInstalled) {
                throw new ModuleNotInstalledError(moduleName);
            }
        }

        return result;
    }
}

export function createPythonProcessService(
    procs: IProcessService,
    // This is composed by the caller.
    env: IPythonEnvironment
) {
    const deps = {
        exec: async (f: string, a: string[], o: SpawnOptions) => procs.exec(f, a, o),
        execObservable: (f: string, a: string[], o: SpawnOptions) => procs.execObservable(f, a, o)
    };
    return new PythonProcessService(env, deps);
}
