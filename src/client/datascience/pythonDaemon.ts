// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { Subject } from 'rxjs/Subject';
import { MessageConnection, RequestType } from 'vscode-jsonrpc';
import { traceError } from '../common/logger';
import { PythonDaemonExecutionService } from '../common/process/pythonDaemon';
import {
    ExecutionResult,
    IPythonExecutionService,
    ObservableExecutionResult,
    Output,
    SpawnOptions
} from '../common/process/types';
import { noop } from '../common/utils/misc';

type ErrorResponse = { error?: string };

export class JupyterDaemonExecutionService extends PythonDaemonExecutionService {
    constructor(
        pythonExecutionService: IPythonExecutionService,
        pythonPath: string,
        daemonProc: ChildProcess,
        connection: MessageConnection
    ) {
        super(pythonExecutionService, pythonPath, daemonProc, connection);
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        if (this.canExecFileUsingDaemon(args, options)) {
            return this.execFileWithDaemonAsObservable(args[0], args.slice(1), options);
        } else {
            return this.pythonExecutionService.execObservable(args, options);
        }
    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        if (this.canExecModuleUsingDaemon(moduleName, args, options)) {
            return this.execModuleWithDaemonAsObservable(moduleName, args, options);
        } else {
            return this.pythonExecutionService.execModuleObservable(moduleName, args, options);
        }
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        if (!this.canExecFileUsingDaemon(args, options)) {
            return this.pythonExecutionService.exec(args, options);
        }
        try {
            return this.execFileWithDaemon(args[0], args.slice(1), options);
        } catch {
            return this.pythonExecutionService.exec(args, options);
        }
    }
    public execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        if (!this.canExecModuleUsingDaemon(moduleName, args, options)) {
            return this.pythonExecutionService.execModule(moduleName, args, options);
        }
        try {
            return this.execModuleWithDaemon(moduleName, args, options);
        } catch {
            return this.pythonExecutionService.execModule(moduleName, args, options);
        }
    }
    private canExecFileUsingDaemon(args: string[], options: SpawnOptions): boolean {
        return args[0].toLowerCase().endsWith('.py') && this.areOptionsSupported(options);
    }
    private canExecModuleUsingDaemon(moduleName: string, args: string[], options: SpawnOptions): boolean {
        if (
            moduleName === 'notebook' ||
            (moduleName === 'jupyter' && args[0] === 'notebook') ||
            (moduleName === 'jupyter' && args.join(',') === 'kernelspec,list') ||
            (moduleName === 'jupyter' && args.join(',') === 'kernelspec,--version')
        ) {
            return this.areOptionsSupported(options);
        } else {
            return false;
        }
    }
    private areOptionsSupported(options: SpawnOptions): boolean {
        const daemonSupportedSpawnOptions: (keyof SpawnOptions)[] = ['cwd', 'env', 'throwOnStdErr', 'token', 'encoding', 'throwOnStdErr', 'mergeStdOutErr'];
        // tslint:disable-next-line: no-any
        return Object.keys(options).every(item => daemonSupportedSpawnOptions.indexOf(item as any) >= 0);
    }
    private async execFileWithDaemon(file: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
        // tslint:disable-next-line: no-any
        const request = new RequestType<{ file_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_file');
        const response = await this.connection.sendRequest(request, { file_name: file, args, cwd: options.cwd, env: options.env });
        if (response.error) {
            traceError('Failed to execute file using the daemon', response.error);
            throw new Error('Failed to execute using the daemon');
        }
        return response;
    }
    private execFileWithDaemonAsObservable(file: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const subject = new Subject<Output<string>>();
        const start = async () => {
            type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
            // tslint:disable-next-line: no-any
            const request = new RequestType<{ file_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_file_observable');
            this.connection.sendRequest(request, { file_name: file, args, cwd: options.cwd, env: options.env }).then(noop, noop);
            this.connection.dispose();
            this.daemonProc.stdout.on('data', (data: string | Buffer) => subject.next({ source: 'stdout', out: data.toString() }));
            this.daemonProc.stderr.on('data', (data: string | Buffer) => subject.next({ source: 'stderr', out: data.toString() }));
            this.daemonProc.once('close', () => subject.complete());
            this.daemonProc.once('exit', () => subject.complete());
            this.daemonProc.once('error', ex => subject.error(ex));
        };
        start().catch(ex => traceError('Failed to run', ex));

        return {
            proc: this.daemonProc,
            dispose: () => this.dispose(),
            out: subject
        };
    }
    private async execModuleWithDaemon(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
        // tslint:disable-next-line: no-any
        const request = new RequestType<{ module_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_module');
        const response = await this.connection.sendRequest(request, { module_name: moduleName, args, cwd: options.cwd, env: options.env });
        if (response.error) {
            traceError('Failed to execute file using the daemon', response.error);
            throw new Error('Failed to execute using the daemon');
        }
        return response;
    }
    private execModuleWithDaemonAsObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const subject = new Subject<Output<string>>();
        const start = async () => {
            type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
            // tslint:disable-next-line: no-any
            const request = new RequestType<{ module_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_module_observable');
            this.connection.sendRequest(request, { module_name: moduleName, args, cwd: options.cwd, env: options.env }).then(noop, noop);
            this.connection.dispose();
            this.daemonProc.stdout.on('data', (data: string | Buffer) => subject.next({ source: 'stdout', out: data.toString() }));
            this.daemonProc.stderr.on('data', (data: string | Buffer) => subject.next({ source: 'stderr', out: data.toString() }));
            this.daemonProc.once('close', () => subject.complete());
            this.daemonProc.once('exit', () => subject.complete());
            this.daemonProc.once('error', ex => subject.error(ex));
        };
        start().catch(ex => traceError('Failed to run', ex));

        return {
            proc: this.daemonProc,
            dispose: () => this.dispose(),
            out: subject
        };
    }
}
