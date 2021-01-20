// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ChildProcess, ExecOptions, SpawnOptions as ChildProcessSpawnOptions } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, Uri } from 'vscode';
import { PythonExecInfo } from '../../pythonEnvironments/exec';
import { InterpreterInformation, PythonEnvironment } from '../../pythonEnvironments/info';
import { ExecutionInfo, IDisposable } from '../types';
import { EnvironmentVariables } from '../variables/types';

export const IBufferDecoder = Symbol('IBufferDecoder');
export interface IBufferDecoder {
    decode(buffers: Buffer[], encoding: string): string;
}

export type Output<T extends string | Buffer> = {
    source: 'stdout' | 'stderr';
    out: T;
};
export type ObservableExecutionResult<T extends string | Buffer> = {
    proc: ChildProcess | undefined;
    out: Observable<Output<T>>;
    dispose(): void;
};

export type SpawnOptions = ChildProcessSpawnOptions & {
    encoding?: string;
    token?: CancellationToken;
    mergeStdOutErr?: boolean;
    throwOnStdErr?: boolean;
    extraVariables?: NodeJS.ProcessEnv;
};

export type ShellOptions = ExecOptions & { throwOnStdErr?: boolean };

export type ExecutionResult<T extends string | Buffer> = {
    stdout: T;
    stderr?: T;
};

export const IProcessLogger = Symbol('IProcessLogger');
export interface IProcessLogger {
    logProcess(file: string, ars: string[], options?: SpawnOptions): void;
}

export interface IProcessService extends IDisposable {
    execObservable(file: string, args: string[], options?: SpawnOptions): ObservableExecutionResult<string>;
    exec(file: string, args: string[], options?: SpawnOptions): Promise<ExecutionResult<string>>;
    shellExec(command: string, options?: ShellOptions): Promise<ExecutionResult<string>>;
    on(event: 'exec', listener: (file: string, args: string[], options?: SpawnOptions) => void): this;
}

export const IProcessServiceFactory = Symbol('IProcessServiceFactory');

export interface IProcessServiceFactory {
    create(resource?: Uri): Promise<IProcessService>;
}

export const IPythonExecutionFactory = Symbol('IPythonExecutionFactory');
export type ExecutionFactoryCreationOptions = {
    resource?: Uri;
    pythonPath?: string;
};
export type ExecutionFactoryCreateWithEnvironmentOptions = {
    resource?: Uri;
    interpreter?: PythonEnvironment;
    allowEnvironmentFetchExceptions?: boolean;
    /**
     * Ignore running `conda run` when running code.
     * It is known to fail in certain scenarios. Where necessary we might want to bypass this.
     *
     * @type {boolean}
     */
    bypassCondaExecution?: boolean;
};
export interface IPythonExecutionFactory {
    create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService>;
    createActivatedEnvironment(options: ExecutionFactoryCreateWithEnvironmentOptions): Promise<IPythonExecutionService>;
    createCondaExecutionService(
        pythonPath: string,
        processService?: IProcessService,
        resource?: Uri,
    ): Promise<IPythonExecutionService | undefined>;
}
export const IPythonExecutionService = Symbol('IPythonExecutionService');

export interface IPythonExecutionService {
    getInterpreterInformation(): Promise<InterpreterInformation | undefined>;
    getExecutablePath(): Promise<string>;
    isModuleInstalled(moduleName: string): Promise<boolean>;
    getModuleVersion(moduleName: string): Promise<string | undefined>;
    getExecutionInfo(pythonArgs?: string[]): PythonExecInfo;

    execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string>;
    execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string>;

    exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
    execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
}

export class StdErrError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export interface IExecutionEnvironmentVariablesService {
    getEnvironmentVariables(resource?: Uri): Promise<EnvironmentVariables | undefined>;
}

export const IPythonToolExecutionService = Symbol('IPythonToolRunnerService');

export interface IPythonToolExecutionService {
    execObservable(
        executionInfo: ExecutionInfo,
        options: SpawnOptions,
        resource: Uri,
    ): Promise<ObservableExecutionResult<string>>;
    exec(executionInfo: ExecutionInfo, options: SpawnOptions, resource: Uri): Promise<ExecutionResult<string>>;
}
