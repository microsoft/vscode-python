// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { spawn } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { Disposable } from 'vscode';
import { createDeferred } from '../utils/async';
import { EnvironmentVariables } from '../variables/types';
import { DEFAULT_ENCODING } from './constants';
import { ExecutionResult, IBufferDecoder, IProcessService, ObservableExecutionResult, Output, SpawnOptions, StdErrError } from './types';

export class ProcessService implements IProcessService {
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
        // tslint:disable-next-line:no-require-imports
        const killProcessTree = require('tree-kill');
        try {
            killProcessTree(pid);
        } catch {
            // Ignore.
        }

    }
    public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : DEFAULT_ENCODING;
        delete options.encoding;
        const spawnOptions = { ...options };
        if (!spawnOptions.env || Object.keys(spawnOptions).length === 0) {
            const env = this.env ? this.env : process.env;
            spawnOptions.env = { ...env };
        }

        // Always ensure we have unbuffered output.
        spawnOptions.env.PYTHONUNBUFFERED = '1';
        if (!spawnOptions.env.PYTHONIOENCODING) {
            spawnOptions.env.PYTHONIOENCODING = 'utf-8';
        }

        const proc = spawn(file, args, spawnOptions);
        let procExited = false;

        const output = new Observable<Output<string>>(subscriber => {
            const disposables: Disposable[] = [];

            const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
                ee.on(name, fn as any);
                disposables.push({ dispose: () => ee.removeListener(name, fn as any) });
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
            proc.once('error', ex => {
                procExited = true;
                subscriber.error(ex);
                disposables.forEach(disposable => disposable.dispose());
            });
        });

        return { proc, out: output };
    }
    public exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : DEFAULT_ENCODING;
        delete options.encoding;
        const spawnOptions = { ...options };
        if (!spawnOptions.env || Object.keys(spawnOptions).length === 0) {
            const env = this.env ? this.env : process.env;
            spawnOptions.env = { ...env };
        }

        // Always ensure we have unbuffered output.
        spawnOptions.env.PYTHONUNBUFFERED = '1';
        if (!spawnOptions.env.PYTHONIOENCODING) {
            spawnOptions.env.PYTHONIOENCODING = 'utf-8';
        }
        const proc = spawn(file, args, spawnOptions);
        const deferred = createDeferred<ExecutionResult<string>>();
        const disposables: Disposable[] = [];

        const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
            ee.on(name, fn as any);
            disposables.push({ dispose: () => ee.removeListener(name, fn as any) });
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
}
