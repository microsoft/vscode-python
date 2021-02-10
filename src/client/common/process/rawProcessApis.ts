// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { exec, execSync, spawn } from 'child_process';
import { Readable } from 'stream';
import { Observable } from 'rxjs/Observable';
import { IDisposable } from '../types';
import { createDeferred } from '../utils/async';
import { EnvironmentVariables } from '../variables/types';
import { DEFAULT_ENCODING } from './constants';
import {
    ExecutionResult,
    IBufferDecoder,
    ObservableExecutionResult,
    Output,
    ShellOptions,
    SpawnOptions,
    StdErrError,
} from './types';

export function getDefaultOptions<T extends ShellOptions | SpawnOptions>(
    options: T,
    defaultEnv?: EnvironmentVariables,
): T {
    const defaultOptions = { ...options };
    const execOptions = defaultOptions as SpawnOptions;
    if (execOptions) {
        execOptions.encoding =
            typeof execOptions.encoding === 'string' && execOptions.encoding.length > 0
                ? execOptions.encoding
                : DEFAULT_ENCODING;
        const { encoding } = execOptions;
        delete execOptions.encoding;
        execOptions.encoding = encoding;
    }
    if (!defaultOptions.env || Object.keys(defaultOptions.env).length === 0) {
        const env = defaultEnv || process.env;
        defaultOptions.env = { ...env };
    } else {
        defaultOptions.env = { ...defaultOptions.env };
    }

    if (execOptions && execOptions.extraVariables) {
        defaultOptions.env = { ...defaultOptions.env, ...execOptions.extraVariables };
    }

    // Always ensure we have unbuffered output.
    defaultOptions.env.PYTHONUNBUFFERED = '1';
    if (!defaultOptions.env.PYTHONIOENCODING) {
        defaultOptions.env.PYTHONIOENCODING = 'utf-8';
    }

    return defaultOptions;
}

export function shellExec(
    command: string,
    options: ShellOptions = {},
    defaultEnv?: EnvironmentVariables,
    disposables?: Set<IDisposable>,
): Promise<ExecutionResult<string>> {
    const shellOptions = getDefaultOptions(options, defaultEnv);
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callback = (e: any, stdout: any, stderr: any) => {
            if (e && e !== null) {
                reject(e);
            } else if (shellOptions.throwOnStdErr && stderr && stderr.length) {
                reject(new Error(stderr));
            } else {
                // Make sure stderr is undefined if we actually had none. This is checked
                // elsewhere because that's how exec behaves.
                resolve({ stderr: stderr && stderr.length > 0 ? stderr : undefined, stdout });
            }
        };
        const proc = exec(command, shellOptions, callback); // NOSONAR
        const disposable: IDisposable = {
            dispose: () => {
                if (!proc.killed) {
                    proc.kill();
                }
            },
        };
        if (disposables) {
            disposables.add(disposable);
        }
    });
}

export function plainExec(
    file: string,
    args: string[],
    options: SpawnOptions = {},
    decoder?: IBufferDecoder,
    defaultEnv?: EnvironmentVariables,
    disposables?: Set<IDisposable>,
): Promise<ExecutionResult<string>> {
    const spawnOptions = getDefaultOptions(options, defaultEnv);
    const encoding = spawnOptions.encoding ? spawnOptions.encoding : 'utf8';
    const proc = spawn(file, args, spawnOptions);
    const deferred = createDeferred<ExecutionResult<string>>();
    const disposable: IDisposable = {
        dispose: () => {
            if (!proc.killed && !deferred.completed) {
                proc.kill();
            }
        },
    };
    disposables?.add(disposable);
    const internalDisposables: IDisposable[] = [];

    // eslint-disable-next-line @typescript-eslint/ban-types
    const on = (ee: Readable | null, name: string, fn: Function) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ee?.on(name, fn as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internalDisposables.push({ dispose: () => ee?.removeListener(name, fn as any) as any });
    };

    if (options.token) {
        internalDisposables.push(options.token.onCancellationRequested(disposable.dispose));
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
        const stderr: string | undefined =
            stderrBuffers.length === 0 ? undefined : decoder?.decode(stderrBuffers, encoding);
        if (stderr && stderr.length > 0 && options.throwOnStdErr) {
            deferred.reject(new StdErrError(stderr));
        } else {
            const stdout = decoder ? decoder.decode(stdoutBuffers, encoding) : '';
            deferred.resolve({ stdout, stderr });
        }
        internalDisposables.forEach((d) => d.dispose());
    });
    proc.once('error', (ex) => {
        deferred.reject(ex);
        internalDisposables.forEach((d) => d.dispose());
    });

    return deferred.promise;
}

export function execObservable(
    file: string,
    args: string[],
    options: SpawnOptions = {},
    decoder?: IBufferDecoder,
    defaultEnv?: EnvironmentVariables,
    disposables?: Set<IDisposable>,
): ObservableExecutionResult<string> {
    const spawnOptions = getDefaultOptions(options, defaultEnv);
    const encoding = spawnOptions.encoding ? spawnOptions.encoding : 'utf8';
    const proc = spawn(file, args, spawnOptions);
    let procExited = false;
    const disposable: IDisposable = {
        dispose() {
            if (proc && !proc.killed && !procExited) {
                killPid(proc.pid);
            }
            if (proc) {
                proc.unref();
            }
        },
    };
    disposables?.add(disposable);

    const output = new Observable<Output<string>>((subscriber) => {
        const internalDisposables: IDisposable[] = [];

        // eslint-disable-next-line @typescript-eslint/ban-types
        const on = (ee: Readable | null, name: string, fn: Function) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ee?.on(name, fn as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            internalDisposables.push({ dispose: () => ee?.removeListener(name, fn as any) as any });
        };

        if (options.token) {
            internalDisposables.push(
                options.token.onCancellationRequested(() => {
                    if (!procExited && !proc.killed) {
                        proc.kill();
                        procExited = true;
                    }
                }),
            );
        }

        const sendOutput = (source: 'stdout' | 'stderr', data: Buffer) => {
            const out = decoder ? decoder.decode([data], encoding) : '';
            if (source === 'stderr' && options.throwOnStdErr) {
                subscriber.error(new StdErrError(out));
            } else {
                subscriber.next({ source, out });
            }
        };

        on(proc.stdout, 'data', (data: Buffer) => sendOutput('stdout', data));
        on(proc.stderr, 'data', (data: Buffer) => sendOutput('stderr', data));

        proc.once('close', () => {
            procExited = true;
            subscriber.complete();
            internalDisposables.forEach((d) => d.dispose());
        });
        proc.once('exit', () => {
            procExited = true;
            subscriber.complete();
            internalDisposables.forEach((d) => d.dispose());
        });
        proc.once('error', (ex) => {
            procExited = true;
            subscriber.error(ex);
            internalDisposables.forEach((d) => d.dispose());
        });
    });

    return {
        proc,
        out: output,
        dispose: disposable.dispose,
    };
}

export function killPid(pid: number): void {
    try {
        if (process.platform === 'win32') {
            // Windows doesn't support SIGTERM, so execute taskkill to kill the process
            execSync(`taskkill /pid ${pid} /T /F`); // NOSONAR
        } else {
            process.kill(pid);
        }
    } catch {
        // Ignore.
    }
}
