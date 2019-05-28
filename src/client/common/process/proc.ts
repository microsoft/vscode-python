// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ChildProcess, exec, execSync, spawn } from 'child_process';
import { Observable } from 'rxjs/Observable';

import { IDisposable } from '../types';
import { createDeferred } from '../utils/async';
import { EnvironmentVariables } from '../variables/types';
import { DEFAULT_ENCODING } from './constants';
import {
    ExecutionResult,
    IBufferDecoder,
    IProcessService,
    ObservableExecutionResult,
    Output,
    ShellOptions,
    SpawnOptions,
    StdErrError
} from './types';

// tslint:disable:no-any
export class ProcessService implements IProcessService, IDisposable {
    private processesToKill = new Set<ChildProcess>();
    constructor(private readonly decoder: IBufferDecoder, private readonly env?: EnvironmentVariables) { }
    public static isAlive(pid: number): boolean {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }
    public static kill(pid: number): void {
        try {
            if (process.platform === 'win32') {
                // Windows doesn't support SIGTERM, so execute taskkill to kill the process
                execSync(`taskkill /pid ${pid} /T /F`);
            } else {
                process.kill(pid);
            }
        } catch {
            // Ignore.
        }
    }
    public dispose() {
        this.processesToKill.forEach(proc => {
            if (proc.killed) {
                return;
            }
            try {
                // Make sure to kill the entire process tree.
                ProcessService.kill(proc.pid);
            } catch {
                // Ignore.
            }
        });
    }

    public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
        const spawnOptions = this.getDefaultOptions(options);
        const encoding = spawnOptions.encoding ? spawnOptions.encoding : 'utf8';
        const proc = spawn(file, args, spawnOptions);
        this.processesToKill.add(proc);
        let procExited = false;

        const output = new Observable<Output<string>>(subscriber => {
            const disposables: IDisposable[] = [];

            const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
                ee.on(name, fn as any);
                disposables.push({ dispose: () => ee.removeListener(name, fn as any) as any });
            };

            if (options.token) {
                disposables.push(options.token.onCancellationRequested(() => {
                    if (!procExited && !proc.killed) {
                        proc.kill();
                        procExited = true;
                    }
                }));
            }

            const sendOutput = (source: 'stdout' | 'stderr', data: Buffer) => {
                const out = this.decoder.decode([data], encoding);
                if (source === 'stderr' && options.throwOnStdErr) {
                    subscriber.error(new StdErrError(out));
                } else {
                    subscriber.next({ source, out: out });
                }
            };

            on(proc.stdout, 'data', (data: Buffer) => sendOutput('stdout', data));
            on(proc.stderr, 'data', (data: Buffer) => sendOutput('stderr', data));

            proc.once('close', () => {
                procExited = true;
                subscriber.complete();
                disposables.forEach(disposable => disposable.dispose());
            });
            proc.once('exit', () => {
                procExited = true;
                subscriber.complete();
                disposables.forEach(disposable => disposable.dispose());
            });
            proc.once('error', ex => {
                procExited = true;
                subscriber.error(ex);
                disposables.forEach(disposable => disposable.dispose());
            });
        });

        return {
            proc,
            out: output,
            dispose: () => {
                if (proc && !proc.killed && !procExited) {
                    ProcessService.kill(proc.pid);
                }
                if (proc) {
                    proc.unref();
                }
            }
        };
    }
    public exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
        const spawnOptions = this.getDefaultOptions(options);
        const encoding = spawnOptions.encoding ? spawnOptions.encoding : 'utf8';
        const proc = spawn(file, args, spawnOptions);
        this.processesToKill.add(proc);
        const deferred = createDeferred<ExecutionResult<string>>();
        const disposables: IDisposable[] = [];

        const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
            ee.on(name, fn as any);
            disposables.push({ dispose: () => ee.removeListener(name, fn as any) as any });
        };

        if (options.token) {
            disposables.push(options.token.onCancellationRequested(() => {
                if (!proc.killed && !deferred.completed) {
                    proc.kill();
                }
            }));
        }

        const stdoutBuffers: Buffer[] = [];
        on(proc.stdout, 'data', (data: Buffer) => stdoutBuffers.push(data));
        const stderrBuffers: Buffer[] = [];
        on(proc.stderr, 'data', (data: Buffer) => {
            if (options.mergeStdOutErr) {
                stdoutBuffers.push(data);
                stderrBuffers.push(data);
            } else {
                stderrBuffers.push(data);
            }
        });

        proc.once('close', () => {
            if (deferred.completed) {
                return;
            }
            const stderr: string | undefined = stderrBuffers.length === 0 ? undefined : this.decoder.decode(stderrBuffers, encoding);
            if (stderr && stderr.length > 0 && options.throwOnStdErr) {
                deferred.reject(new StdErrError(stderr));
            } else {
                const stdout = this.decoder.decode(stdoutBuffers, encoding);
                deferred.resolve({ stdout, stderr });
            }
            disposables.forEach(disposable => disposable.dispose());
        });
        proc.once('error', ex => {
            deferred.reject(ex);
            disposables.forEach(disposable => disposable.dispose());
        });

        return deferred.promise;
    }

    public shellExec(command: string, options: ShellOptions = {}): Promise<ExecutionResult<string>> {
        const shellOptions = this.getDefaultOptions(options);
        return new Promise((resolve, reject) => {
            const proc = exec(command, shellOptions, (e, stdout, stderr) => {
                if (e && e !== null) {
                    reject(e);
                } else if (shellOptions.throwOnStdErr && stderr && stderr.length) {
                    reject(new Error(stderr));
                } else {
                    // Make sure stderr is undefined if we actually had none. This is checked
                    // elsewhere because that's how exec behaves.
                    resolve({ stderr: stderr && stderr.length > 0 ? stderr : undefined, stdout: stdout });
                }
            });
            this.processesToKill.add(proc);
        });
    }

    private getDefaultOptions<T extends (ShellOptions | SpawnOptions)>(options: T): T {
        const defaultOptions = { ...options };
        const execOptions = defaultOptions as SpawnOptions;
        if (execOptions) {
            const encoding = execOptions.encoding = typeof execOptions.encoding === 'string' && execOptions.encoding.length > 0 ? execOptions.encoding : DEFAULT_ENCODING;
            delete execOptions.encoding;
            execOptions.encoding = encoding;
        }
        if (!defaultOptions.env || Object.keys(defaultOptions.env).length === 0) {
            const env = this.env ? this.env : process.env;
            defaultOptions.env = { ...env };
        } else {
            defaultOptions.env = { ...defaultOptions.env };
        }

        // Always ensure we have unbuffered output.
        defaultOptions.env.PYTHONUNBUFFERED = '1';
        if (!defaultOptions.env.PYTHONIOENCODING) {
            defaultOptions.env.PYTHONIOENCODING = 'utf-8';
        }

        return defaultOptions;
    }

}
