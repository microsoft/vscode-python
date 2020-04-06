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

class PythonProcessService {
    constructor(
        // This is the externally defined functionality used by the class.
        private readonly deps: {
            // from PythonEnvironment:
            isModuleInstalled(moduleName: string): Promise<boolean>;
            getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo;
            getExecutionObservableInfo(pythonArgs?: string[]): PythonExecutionInfo;
            // from ProcessService:
            exec(file: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
            execObservable(file: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string>;
        }
    ) {}

    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        const executable = this.deps.getExecutionObservableInfo(args);
        return this.deps.execObservable(executable.command, executable.args, opts);
    }

    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        const executable = this.deps.getExecutionObservableInfo(['-m', moduleName, ...args]);
        return this.deps.execObservable(executable.command, executable.args, opts);
    }

    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        const executable = this.deps.getExecutionInfo(args);
        return this.deps.exec(executable.command, executable.args, opts);
    }

    public async execModule(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        const executable = this.deps.getExecutionInfo(['-m', moduleName, ...args]);
        const result = await this.deps.exec(executable.command, executable.args, opts);

        // If a module is not installed we'll have something in stderr.
        if (moduleName && ErrorUtils.outputHasModuleNotInstalledError(moduleName, result.stderr)) {
            const isInstalled = await this.deps.isModuleInstalled(moduleName);
            if (!isInstalled) {
                throw new ModuleNotInstalledError(moduleName);
            }
        }

        return result;
    }
}

interface IPythonEnvironment {
    getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo;
    getExecutionObservableInfo(pythonArgs?: string[]): PythonExecutionInfo;
    isModuleInstalled(moduleName: string): Promise<boolean>;
}

export function createPythonProcessService(
    procs: IProcessService,
    // This is composed by the caller.
    env: IPythonEnvironment
) {
    const deps = {
        // from PythonService:
        isModuleInstalled: async (moduleName: string) => env.isModuleInstalled(moduleName),
        getExecutionInfo: (pythonArgs?: string[]) => env.getExecutionInfo(pythonArgs),
        getExecutionObservableInfo: (pythonArgs?: string[]) => env.getExecutionObservableInfo(pythonArgs),
        // from ProcessService:
        exec: async (f: string, a: string[], o: SpawnOptions) => procs.exec(f, a, o),
        execObservable: (f: string, a: string[], o: SpawnOptions) => procs.execObservable(f, a, o)
    };
    return new PythonProcessService(deps);
}
