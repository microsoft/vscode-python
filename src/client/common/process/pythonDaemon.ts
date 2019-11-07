// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { MessageConnection, RequestType, RequestType0 } from 'vscode-jsonrpc';
import { Architecture } from '../utils/platform';
import { parsePythonVersion } from '../utils/version';
import {
    ExecutionResult,
    InterpreterInfomation,
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    PythonVersionInfo,
    SpawnOptions
} from './types';

type ErrorResponse = { error?: string };

export class PythonDaemonExecutionService implements IPythonDaemonExecutionService {
    constructor(
        protected readonly pythonExecutionService: IPythonExecutionService,
        protected readonly pythonPath: string,
        protected readonly daemonProc: ChildProcess,
        protected readonly connection: MessageConnection
    ) {}
    public dispose() {
        this.connection.dispose();
        this.daemonProc.kill();
    }
    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        try {
            type InterpreterInfoResponse = ErrorResponse & { versionInfo: PythonVersionInfo; sysPrefix: string; sysVersion: string; is64Bit: boolean };
            const request = new RequestType0<InterpreterInfoResponse, void, void>('get_interpreter_information');
            const response = await this.connection.sendRequest(request);
            const versionValue = response.versionInfo.length === 4 ? `${response.versionInfo.slice(0, 3).join('.')}-${response.versionInfo[3]}` : response.versionInfo.join('.');
            return {
                architecture: response.is64Bit ? Architecture.x64 : Architecture.x86,
                path: this.pythonPath,
                version: parsePythonVersion(versionValue),
                sysVersion: response.sysVersion,
                sysPrefix: response.sysPrefix
            };
        } catch {
            return this.pythonExecutionService.getInterpreterInformation();
        }
    }
    public async getExecutablePath(): Promise<string> {
        try {
            type ExecutablePathResponse = ErrorResponse & { path: string };
            const request = new RequestType0<ExecutablePathResponse, void, void>('get_executable');
            const response = await this.connection.sendRequest(request);
            if (response.error){
                throw new Error(response.error);
            }
            return response.path;
        } catch {
            return this.pythonExecutionService.getExecutablePath();
        }
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        try {
            type ModuleInstalledResponse = ErrorResponse & { exists: boolean };
            const request = new RequestType<{ module_name: string }, ModuleInstalledResponse, void, void>('is_module_installed');
            const response = await this.connection.sendRequest(request, { module_name: moduleName });
            if (response.error){
                throw new Error(response.error);
            }
            return response.exists;
        } catch {
            return this.pythonExecutionService.isModuleInstalled(moduleName);
        }
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.pythonExecutionService.execObservable(args, options);
    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.pythonExecutionService.execModuleObservable(moduleName, args, options);
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.pythonExecutionService.exec(args, options);
    }
    public execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.pythonExecutionService.execModule(moduleName, args, options);
    }
}
