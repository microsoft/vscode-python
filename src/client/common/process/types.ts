// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ChildProcess, ExecOptions, SpawnOptions as ChildProcessSpawnOptions } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, Uri } from 'vscode';

import { PythonInterpreter } from '../../interpreter/contracts';
import { Newable } from '../../ioc/types';
import { ExecutionInfo, IDisposable, Version } from '../types';
import { Architecture } from '../utils/platform';
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

// tslint:disable-next-line:interface-name
export type SpawnOptions = ChildProcessSpawnOptions & {
    encoding?: string;
    token?: CancellationToken;
    mergeStdOutErr?: boolean;
    throwOnStdErr?: boolean;
};

// tslint:disable-next-line:interface-name
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
export type DaemonExecutionFactoryCreationOptions = ExecutionFactoryCreationOptions & {
    /**
     * Python file that implements the daemon.
     *
     * @type {string}
     */
    daemonModule: string;
    daemonClass: Newable<IPythonDaemonExecutionService>;
};
export type ExecutionFactoryCreateWithEnvironmentOptions = {
    resource?: Uri;
    pythonPath?: string;
    interpreter?: PythonInterpreter;
    allowEnvironmentFetchExceptions?: boolean;
};
export interface IPythonExecutionFactory {
    create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService>;
    /**
     * Creates a daemon Python Process.
     * On windows its cheapter to create a daemon and use that than spin up Python Processes everytime.
     * The returned object implements an IDisposable so as to allow terminating the daemon process.
     * If something cannot be executed within the daemin, it will resort to using the stanard IPythonExecutionService.
     * Note: The returned execution service is always using an activated environment.
     *
     * @param {ExecutionFactoryCreationOptions} options
     * @returns {(Promise<IPythonExecutionService & IDisposable>)}
     * @memberof IPythonExecutionFactory
     */
    createDaemon(options:  DaemonExecutionFactoryCreationOptions): Promise<IPythonDaemonExecutionService>;
    createActivatedEnvironment(options: ExecutionFactoryCreateWithEnvironmentOptions): Promise<IPythonExecutionService>;
}
export type ReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final' | 'unknown';
export type PythonVersionInfo = [number, number, number, ReleaseLevel];
export type InterpreterInfomation = {
    path: string;
    version?: Version;
    sysVersion: string;
    architecture: Architecture;
    sysPrefix: string;
    pipEnvWorkspaceFolder?: string;
};
export const IPythonExecutionService = Symbol('IPythonExecutionService');

export interface IPythonExecutionService {
    getInterpreterInformation(): Promise<InterpreterInfomation | undefined>;
    getExecutablePath(): Promise<string>;
    isModuleInstalled(moduleName: string): Promise<boolean>;

    execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string>;
    execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string>;

    exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
    execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
}

/**
 * Identical to the PythonExecutionService, but with a `dispose` method.
 * This is a daemon process that lives on until it is disposed, hence the `IDisposable`.
 *
 * @export
 * @interface IPythonDaemonExecutionService
 * @extends {IPythonExecutionService}
 * @extends {IDisposable}
 */
export interface IPythonDaemonExecutionService extends IPythonExecutionService, IDisposable {
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
    execObservable(executionInfo: ExecutionInfo, options: SpawnOptions, resource: Uri): Promise<ObservableExecutionResult<string>>;
    exec(executionInfo: ExecutionInfo, options: SpawnOptions, resource: Uri): Promise<ExecutionResult<string>>;
}
