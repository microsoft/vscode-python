// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import * as os from 'os';
import { Subject } from 'rxjs/Subject';
import * as util from 'util';
import { MessageConnection, NotificationType, RequestType, RequestType0 } from 'vscode-jsonrpc';
import { traceError, traceWarning } from '../logger';
import { IDisposable } from '../types';
import { noop } from '../utils/misc';
import { Architecture } from '../utils/platform';
import { parsePythonVersion } from '../utils/version';
import {
    ExecutionResult,
    InterpreterInfomation,
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    Output,
    PythonVersionInfo,
    SpawnOptions,
    StdErrError
} from './types';

type ErrorResponse = { error?: string };

export class PythonDaemonExecutionService implements IPythonDaemonExecutionService {
    private connectionClosedMessage?: string;
    private outputObservale = new Subject<Output<string>>();
    private disposables: IDisposable[] = [];
    constructor(
        protected readonly pythonExecutionService: IPythonExecutionService,
        protected readonly pythonPath: string,
        protected readonly daemonProc: ChildProcess,
        protected readonly connection: MessageConnection
    ) {
        this.monitorConnection();
    }
    public dispose() {
        try {
            this.connection.dispose();
            this.daemonProc.kill();
        } catch {
            noop();
        }
        this.disposables.forEach(item => item.dispose());
    }
    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        this.throwIfRPCConnectionIsDead();
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
        this.throwIfRPCConnectionIsDead();
        try {
            type ExecutablePathResponse = ErrorResponse & { path: string };
            const request = new RequestType0<ExecutablePathResponse, void, void>('get_executable');
            const response = await this.connection.sendRequest(request);
            if (response.error) {
                throw new Error(response.error);
            }
            return response.path;
        } catch {
            return this.pythonExecutionService.getExecutablePath();
        }
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        this.throwIfRPCConnectionIsDead();
        try {
            type ModuleInstalledResponse = ErrorResponse & { exists: boolean };
            const request = new RequestType<{ module_name: string }, ModuleInstalledResponse, void, void>('is_module_installed');
            const response = await this.connection.sendRequest(request, { module_name: moduleName });
            if (response.error) {
                throw new Error(response.error);
            }
            return response.exists;
        } catch {
            return this.pythonExecutionService.isModuleInstalled(moduleName);
        }
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        this.throwIfRPCConnectionIsDead();
        if (this.canExecFileUsingDaemon(args, options)) {
            return this.execFileWithDaemonAsObservable(args[0], args.slice(1), options);
        } else {
            return this.pythonExecutionService.execObservable(args, options);
        }
    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        this.throwIfRPCConnectionIsDead();
        if (this.canExecModuleUsingDaemon(moduleName, args, options)) {
            return this.execModuleWithDaemonAsObservable(moduleName, args, options);
        } else {
            return this.pythonExecutionService.execModuleObservable(moduleName, args, options);
        }
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        this.throwIfRPCConnectionIsDead();
        if (!this.canExecFileUsingDaemon(args, options)) {
            return this.pythonExecutionService.exec(args, options);
        }
        try {
            return await this.execFileWithDaemon(args[0], args.slice(1), options);
        } catch (ex) {
            // This is a handled error (error from user code that must be bubbled up).
            if (ex instanceof StdErrError){
                throw ex;
            }
            return this.pythonExecutionService.exec(args, options);
        }
    }
    public async execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        this.throwIfRPCConnectionIsDead();
        if (!this.canExecModuleUsingDaemon(moduleName, args, options)) {
            return this.pythonExecutionService.execModule(moduleName, args, options);
        }
        try {
            return await this.execModuleWithDaemon(moduleName, args, options);
        } catch (ex) {
            // This is a handled error (error from user code that must be bubbled up).
            if (ex instanceof StdErrError){
                throw ex;
            }
            return this.pythonExecutionService.execModule(moduleName, args, options);
        }
    }
    protected canExecFileUsingDaemon(args: string[], options: SpawnOptions): boolean {
        return args[0].toLowerCase().endsWith('.py') && this.areOptionsSupported(options);
    }
    protected canExecModuleUsingDaemon(_moduleName: string, _args: string[], options: SpawnOptions): boolean {
        return this.areOptionsSupported(options);
    }
    protected areOptionsSupported(options: SpawnOptions): boolean {
        const daemonSupportedSpawnOptions: (keyof SpawnOptions)[] = ['cwd', 'env', 'throwOnStdErr', 'token', 'encoding', 'mergeStdOutErr'];
        // tslint:disable-next-line: no-any
        return Object.keys(options).every(item => daemonSupportedSpawnOptions.indexOf(item as any) >= 0);
    }
    /**
     * Process the response.
     *
     * @private
     * @param {{ error?: string | undefined; stdout: string; stderr?: string }} response
     * @param {SpawnOptions} options
     * @memberof PythonDaemonExecutionService
     */
    private processResponse(response: { error?: string | undefined; stdout: string; stderr?: string }, options: SpawnOptions) {
        if (response.error) {
            traceError('Failed to execute file using the daemon', response.error);
            throw new StdErrError(`Failed to execute using the daemon, ${response.error}`);
        }
        // Throw an error if configured to do so if there's any output in stderr.
        if (response.stderr && options.throwOnStdErr) {
            throw new StdErrError(response.stderr);
        }
        // Merge stdout and stderr into on if configured to do so.
        if (response.stderr && options.mergeStdOutErr) {
            response.stdout = `${response.stdout || ''}${os.EOL}${response.stderr}`;
        }
    }
    private async execFileWithDaemon(fileName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
        // tslint:disable-next-line: no-any
        const request = new RequestType<{ file_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_file');
        const response = await this.connection.sendRequest(request, { file_name: fileName, args, cwd: options.cwd, env: options.env });
        this.processResponse(response, options);
        return response;
    }
    private execFileWithDaemonAsObservable(fileName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.execAsObservable({ fileName }, args, options);
    }
    private async execModuleWithDaemon(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
        // tslint:disable-next-line: no-any
        const request = new RequestType<{ module_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_module');
        const response = await this.connection.sendRequest(request, { module_name: moduleName, args, cwd: options.cwd, env: options.env });
        this.processResponse(response, options);
        return response;
    }
    private execModuleWithDaemonAsObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.execAsObservable({ moduleName }, args, options);
    }
    private execAsObservable(moduleOrFile: { moduleName: string } | { fileName: string }, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const subject = new Subject<Output<string>>();
        const start = async () => {
            type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
            if ('fileName' in moduleOrFile) {
                // tslint:disable-next-line: no-any
                const request = new RequestType<{ file_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_file_observable');
                await this.connection.sendRequest(request, { file_name: moduleOrFile.fileName, args, cwd: options.cwd, env: options.env });
            } else {
                // tslint:disable-next-line: no-any
                const request = new RequestType<{ module_name: string; args: string[]; cwd?: string; env?: any }, ExecResponse, void, void>('exec_module_observable');
                await this.connection.sendRequest(request, { module_name: moduleOrFile.moduleName, args, cwd: options.cwd, env: options.env });
            }
        };
        let stdErr = '';
        this.daemonProc.stderr.on('data', (output: string | Buffer) => (stdErr += output.toString()));
        // Wire up stdout/stderr.
        const subscription = this.outputObservale.subscribe(out => {
            if (out.source === 'stderr' && options.throwOnStdErr) {
                subject.error(new StdErrError(out.out));
            } else if (out.source === 'stderr' && options.mergeStdOutErr) {
                subject.next({ source: 'stdout', out: out.out });
            } else {
                subject.next(out);
            }
        });
        start()
            .catch(ex => {
                const errorMsg = `Failed to run ${'fileName' in moduleOrFile ? moduleOrFile.fileName : moduleOrFile.moduleName} as observable with args ${args.join(' ')}`;
                traceError(errorMsg, ex);
                subject.next({ source: 'stderr', out: `${errorMsg}\n${stdErr}` });
                subject.error(ex);
            })
            .finally(() => {
                // Wait until all messages are received.
                setTimeout(() => {
                    subscription.unsubscribe();
                    subject.complete();
                }, 100);
            })
            .ignoreErrors();

        return {
            proc: this.daemonProc,
            dispose: () => this.dispose(),
            out: subject
        };
    }
    private monitorConnection() {
        // tslint:disable-next-line: no-any
        const logConnectionStatus = (msg: string, ex?: any) => {
            this.connectionClosedMessage = msg + (ex ? `, With Error: ${util.format(ex)}` : '');
            traceWarning(msg);
            if (ex) {
                traceError('Connection errored', ex);
            }
        };
        this.disposables.push(this.connection.onClose(() => logConnectionStatus('Daemon Connection Closed')));
        this.disposables.push(this.connection.onDispose(() => logConnectionStatus('Daemon Connection disposed')));
        this.disposables.push(this.connection.onError(ex => logConnectionStatus('Daemon Connection errored', ex)));
        // Wire up stdout/stderr.
        const OuputNotification = new NotificationType<Output<string>, void>('output');
        this.connection.onNotification(OuputNotification, output => this.outputObservale.next(output));
    }
    private throwIfRPCConnectionIsDead() {
        if (this.connectionClosedMessage) {
            throw new Error(this.connectionClosedMessage);
        }
    }
}
