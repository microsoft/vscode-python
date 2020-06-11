// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { MessageConnection, RequestType, RequestType0 } from 'vscode-jsonrpc';
import { InterpreterInformation, PythonVersionInfo } from '../../pythonEnvironments/discovery/types';
import { traceWarning } from '../logger';
import { Architecture } from '../utils/platform';
import { parsePythonVersion } from '../utils/version';
import { BasePythonDaemon } from './baseDaemon';
import {
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    PythonExecutionInfo,
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
        pythonPath: string,
        proc: ChildProcess,
        connection: MessageConnection
    ) {
        super(pythonExecutionService, pythonPath, proc, connection);
    }
    public async getInterpreterInformation(): Promise<InterpreterInformation | undefined> {
        try {
            this.throwIfRPCConnectionIsDead();
            type InterpreterInfoResponse = ErrorResponse & {
                versionInfo: PythonVersionInfo;
                sysPrefix: string;
                sysVersion: string;
                is64Bit: boolean;
            };
            const request = new RequestType0<InterpreterInfoResponse, void, void>('get_interpreter_information');
            const response = await this.sendRequestWithoutArgs(request);
            const versionValue =
                response.versionInfo.length === 4
                    ? `${response.versionInfo.slice(0, 3).join('.')}-${response.versionInfo[3]}`
                    : response.versionInfo.join('.');
            return {
                architecture: response.is64Bit ? Architecture.x64 : Architecture.x86,
                path: this.pythonPath,
                version: parsePythonVersion(versionValue),
                sysVersion: response.sysVersion,
                sysPrefix: response.sysPrefix
            };
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
    public getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo {
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
