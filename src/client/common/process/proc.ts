// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { spawn } from 'child_process';
import { inject, injectable } from 'inversify';
import 'reflect-metadata';
import * as Rx from 'rxjs';
import { Disposable } from 'vscode';
import { createDeferred } from '../helpers';
import { DEFAULT_ENCODING } from './constants';
import { ExecutionResult, IBufferDecoder, IProcessService, ObservableExecutionResult, Output, SpawnOptions, StdErrError } from './types';

@injectable()
export class ProcessService implements IProcessService {
    constructor( @inject(IBufferDecoder) private decoder: IBufferDecoder) { }
    public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : DEFAULT_ENCODING;
        const spawnOptions = { ...options };
        if (!spawnOptions.env || Object.keys(spawnOptions).length === 0) {
            spawnOptions.env = process.env;
        }
        const proc = spawn(file, args, spawnOptions);
        let procExited = false;

        const output = new Rx.Observable<Output<string>>(subscriber => {
            const disposables: Disposable[] = [];

            const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
                ee.on(name, fn);
                disposables.push({ dispose: () => ee.removeListener(name, fn) });
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
                    source = options.mergeStdOutErr ? 'stdout' : source;
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
    public async exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : DEFAULT_ENCODING;
        const spawnOptions = { ...options };
        if (!spawnOptions.env || Object.keys(spawnOptions).length === 0) {
            spawnOptions.env = process.env;
        }
        const proc = spawn(file, args, spawnOptions);
        const deferred = createDeferred<ExecutionResult<string>>();
        const disposables: Disposable[] = [];

        const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
            ee.on(name, fn);
            disposables.push({ dispose: () => ee.removeListener(name, fn) });
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
