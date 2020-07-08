// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { MessageConnection, RequestType, RequestType0 } from 'vscode-jsonrpc';
import { PythonExecInfo } from '../../pythonEnvironments/exec';
import { InterpreterInformation } from '../../pythonEnvironments/info';
import { extractInterpreterInfo } from '../../pythonEnvironments/info/interpreter';
import { traceWarning } from '../logger';
import { IPlatformService } from '../platform/types';
import { BasePythonDaemon } from './baseDaemon';
import { PythonEnvInfo } from './internal/scripts';
import {
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    SpawnOptions
} from './types';

type ErrorResponse = { error?: string };

export class ConnectionClosedError extends Error {
    constructor(public readonly message: string) {
        super();
    }
}

export class DaemonError extends Error {
    constructor(public readonly message: string) {
        super();
    }
}
export class PythonDaemonExecutionService extends BasePythonDaemon implements IPythonDaemonExecutionService {
    constructor(
        pythonExecutionService: IPythonExecutionService,
        platformService: IPlatformService,
        pythonPath: string,
        proc: ChildProcess,
        connection: MessageConnection
    ) {
        super(pythonExecutionService, platformService, pythonPath, proc, connection);
    }
    public async getInterpreterInformation(): Promise<InterpreterInformation | undefined> {
        try {
            this.throwIfRPCConnectionIsDead();
            const request = new RequestType0<PythonEnvInfo & ErrorResponse, void, void>('get_interpreter_information');
            const response = await this.sendRequestWithoutArgs(request);
            if (response.error) {
                throw Error(response.error);
            }
            return extractInterpreterInfo(this.pythonPath, response);
        } catch (ex) {
            traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
            return this.pythonExecutionService.getInterpreterInformation();
        }
    }
    public async getExecutablePath(): Promise<string> {
        try {
            this.throwIfRPCConnectionIsDead();
            type ExecutablePathResponse = ErrorResponse & { path: string };
            const request = new RequestType0<ExecutablePathResponse, void, void>('get_executable');
            const response = await this.sendRequestWithoutArgs(request);
            if (response.error) {
                throw new DaemonError(response.error);
            }
            return response.path;
        } catch (ex) {
            traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
            return this.pythonExecutionService.getExecutablePath();
        }
    }
    public getExecutionInfo(pythonArgs?: string[]): PythonExecInfo {
        return this.pythonExecutionService.getExecutionInfo(pythonArgs);
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        try {
            this.throwIfRPCConnectionIsDead();
            type ModuleInstalledResponse = ErrorResponse & { exists: boolean };
            const request = new RequestType<{ module_name: string }, ModuleInstalledResponse, void, void>(
                'is_module_installed'
            );
            const response = await this.sendRequest(request, { module_name: moduleName });
            if (response.error) {
                throw new DaemonError(response.error);
            }
            return response.exists;
        } catch (ex) {
            traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
            return this.pythonExecutionService.isModuleInstalled(moduleName);
        }
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        if (this.isAlive && this.canExecFileUsingDaemon(args, options)) {
            try {
                return this.execAsObservable({ fileName: args[0] }, args.slice(1), options);
            } catch (ex) {
                if (ex instanceof DaemonError || ex instanceof ConnectionClosedError) {
                    traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
                    return this.pythonExecutionService.execObservable(args, options);
                } else {
                    throw ex;
                }
            }
        } else {
            return this.pythonExecutionService.execObservable(args, options);
        }
    }
    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        if (this.isAlive && this.canExecModuleUsingDaemon(moduleName, args, options)) {
            try {
                return this.execAsObservable({ moduleName }, args, options);
            } catch (ex) {
                if (ex instanceof DaemonError || ex instanceof ConnectionClosedError) {
                    traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
                    return this.pythonExecutionService.execModuleObservable(moduleName, args, options);
                } else {
                    throw ex;
                }
            }
        } else {
            return this.pythonExecutionService.execModuleObservable(moduleName, args, options);
        }
    }
}
