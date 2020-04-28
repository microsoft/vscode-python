// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import * as os from 'os';
import { Subject } from 'rxjs/Subject';
import * as util from 'util';
import { MessageConnection, NotificationType, RequestType, RequestType0 } from 'vscode-jsonrpc';
import { traceError, traceInfo, traceVerbose, traceWarning } from '../logger';
import { IDisposable } from '../types';
import { createDeferred, Deferred } from '../utils/async';
import { noop } from '../utils/misc';
import {
    ExecutionResult,
    IPythonExecutionService,
    ObservableExecutionResult,
    Output,
    SpawnOptions,
    StdErrError
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
export abstract class BasePythonDaemon {
    public get isAlive(): boolean {
        return this.connectionClosedMessage === '';
    }
    protected outputObservale = new Subject<Output<string>>();
    private connectionClosedMessage: string = '';
    protected get closed() {
        return this.connectionClosedDeferred.promise;
    }
    // tslint:disable-next-line: no-any
    private readonly connectionClosedDeferred: Deferred<any>;
    private disposables: IDisposable[] = [];
    private disposed = false;
    constructor(
        protected readonly pythonExecutionService: IPythonExecutionService,
        protected readonly pythonPath: string,
        public readonly proc: ChildProcess,
        public readonly connection: MessageConnection
    ) {
        // tslint:disable-next-line: no-any
        this.connectionClosedDeferred = createDeferred<any>();
        // This promise gets used conditionally, if it doesn't get used, and the promise is rejected,
        // then node logs errors. We don't want that, hence add a dummy error handler.
        this.connectionClosedDeferred.promise.catch(noop);
        this.monitorConnection();
    }
    public dispose() {
        try {
            this.disposed = true;
            // The daemon should die as a result of this.
            this.connection.sendNotification(new NotificationType('exit'));
            this.proc.kill();
        } catch {
            noop();
        }
        this.disposables.forEach((item) => item.dispose());
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
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        if (this.isAlive && this.canExecFileUsingDaemon(args, options)) {
            try {
                return await this.execFileWithDaemon(args[0], args.slice(1), options);
            } catch (ex) {
                if (ex instanceof DaemonError || ex instanceof ConnectionClosedError) {
                    traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
                    return this.pythonExecutionService.exec(args, options);
                } else {
                    throw ex;
                }
            }
        } else {
            return this.pythonExecutionService.exec(args, options);
        }
    }
    public async execModule(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        if (this.isAlive && this.canExecModuleUsingDaemon(moduleName, args, options)) {
            try {
                return await this.execModuleWithDaemon(moduleName, args, options);
            } catch (ex) {
                if (ex instanceof DaemonError || ex instanceof ConnectionClosedError) {
                    traceWarning('Falling back to Python Execution Service due to failure in daemon', ex);
                    return this.pythonExecutionService.execModule(moduleName, args, options);
                } else {
                    throw ex;
                }
            }
        } else {
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
        const daemonSupportedSpawnOptions: (keyof SpawnOptions)[] = [
            'cwd',
            'env',
            'throwOnStdErr',
            'token',
            'encoding',
            'mergeStdOutErr',
            'extraVariables'
        ];
        // tslint:disable-next-line: no-any
        return Object.keys(options).every((item) => daemonSupportedSpawnOptions.indexOf(item as any) >= 0);
    }
    protected sendRequestWithoutArgs<R, E, RO>(type: RequestType0<R, E, RO>): Thenable<R> {
        return Promise.race([this.connection.sendRequest(type), this.connectionClosedDeferred.promise]);
    }
    protected sendRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, params?: P): Thenable<R> {
        // Throw an error if the connection has been closed.
        return Promise.race([this.connection.sendRequest(type, params), this.connectionClosedDeferred.promise]);
    }
    protected throwIfRPCConnectionIsDead() {
        if (!this.isAlive) {
            throw new ConnectionClosedError(this.connectionClosedMessage);
        }
    }
    protected execAsObservable(
        moduleOrFile: { moduleName: string } | { fileName: string },
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        const subject = new Subject<Output<string>>();
        const start = async () => {
            type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
            let response: ExecResponse;
            if ('fileName' in moduleOrFile) {
                const request = new RequestType<
                    // tslint:disable-next-line: no-any
                    { file_name: string; args: string[]; cwd?: string; env?: any },
                    ExecResponse,
                    void,
                    void
                >('exec_file_observable');
                response = await this.sendRequest(request, {
                    file_name: moduleOrFile.fileName,
                    args,
                    cwd: options.cwd,
                    env: options.env
                });
            } else {
                const request = new RequestType<
                    // tslint:disable-next-line: no-any
                    { module_name: string; args: string[]; cwd?: string; env?: any },
                    ExecResponse,
                    void,
                    void
                >('exec_module_observable');
                response = await this.sendRequest(request, {
                    module_name: moduleOrFile.moduleName,
                    args,
                    cwd: options.cwd,
                    env: options.env
                });
            }
            // Might not get a response object back, as its observable.
            if (response && response.error) {
                throw new DaemonError(response.error);
            }
        };
        let stdErr = '';
        this.proc.stderr.on('data', (output: string | Buffer) => (stdErr += output.toString()));
        // Wire up stdout/stderr.
        const subscription = this.outputObservale.subscribe((out) => {
            if (out.source === 'stderr' && options.throwOnStdErr) {
                subject.error(new StdErrError(out.out));
            } else if (out.source === 'stderr' && options.mergeStdOutErr) {
                subject.next({ source: 'stdout', out: out.out });
            } else {
                subject.next(out);
            }
        });
        start()
            .catch((ex) => {
                const errorMsg = `Failed to run ${
                    'fileName' in moduleOrFile ? moduleOrFile.fileName : moduleOrFile.moduleName
                } as observable with args ${args.join(' ')}`;
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
            proc: this.proc,
            dispose: () => this.dispose(),
            out: subject
        };
    }
    /**
     * Process the response.
     *
     * @private
     * @param {{ error?: string | undefined; stdout: string; stderr?: string }} response
     * @param {SpawnOptions} options
     * @memberof PythonDaemonExecutionService
     */
    private processResponse(
        response: { error?: string | undefined; stdout: string; stderr?: string },
        options: SpawnOptions
    ) {
        if (response.error) {
            throw new DaemonError(`Failed to execute using the daemon, ${response.error}`);
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
    private async execFileWithDaemon(
        fileName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
        const request = new RequestType<
            // tslint:disable-next-line: no-any
            { file_name: string; args: string[]; cwd?: string; env?: any },
            ExecResponse,
            void,
            void
        >('exec_file');
        const response = await this.sendRequest(request, {
            file_name: fileName,
            args,
            cwd: options.cwd,
            env: options.env
        });
        this.processResponse(response, options);
        return response;
    }
    private async execModuleWithDaemon(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        type ExecResponse = ErrorResponse & { stdout: string; stderr?: string };
        const request = new RequestType<
            // tslint:disable-next-line: no-any
            { module_name: string; args: string[]; cwd?: string; env?: any },
            ExecResponse,
            void,
            void
        >('exec_module');
        const response = await this.sendRequest(request, {
            module_name: moduleName,
            args,
            cwd: options.cwd,
            env: options.env
        });
        this.processResponse(response, options);
        return response;
    }
    private monitorConnection() {
        // tslint:disable-next-line: no-any
        const logConnectionStatus = (msg: string, ex?: any) => {
            if (!this.disposed) {
                this.connectionClosedMessage += msg + (ex ? `, With Error: ${util.format(ex)}` : '');
                this.connectionClosedDeferred.reject(new ConnectionClosedError(this.connectionClosedMessage));
                traceWarning(msg);
                if (ex) {
                    traceError('Connection errored', ex);
                }
            }
        };
        this.disposables.push(this.connection.onClose(() => logConnectionStatus('Daemon Connection Closed')));
        this.disposables.push(this.connection.onDispose(() => logConnectionStatus('Daemon Connection disposed')));
        this.disposables.push(this.connection.onError((ex) => logConnectionStatus('Daemon Connection errored', ex)));
        // this.proc.on('error', error => logConnectionStatus('Daemon Processed died with error', error));
        this.proc.on('exit', (code) => logConnectionStatus('Daemon Processed died with exit code', code));
        // Wire up stdout/stderr.
        const OuputNotification = new NotificationType<Output<string>, void>('output');
        this.connection.onNotification(OuputNotification, (output) => this.outputObservale.next(output));
        const logNotification = new NotificationType<
            { level: 'WARN' | 'WARNING' | 'INFO' | 'DEBUG' | 'NOTSET'; msg: string; pid?: string },
            void
        >('log');
        this.connection.onNotification(logNotification, (output) => {
            const pid = output.pid ? ` (pid: ${output.pid})` : '';
            const msg = `Python Daemon${pid}: ${output.msg}`;
            if (output.level === 'DEBUG' || output.level === 'NOTSET') {
                traceVerbose(msg);
            } else if (output.level === 'INFO') {
                traceInfo(msg);
            } else if (output.level === 'WARN' || output.level === 'WARNING') {
                traceWarning(msg);
            } else {
                traceError(msg);
            }
        });
        this.connection.onUnhandledNotification(traceError);
    }
}
