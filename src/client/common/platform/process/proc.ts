import { spawn } from 'child_process';
import { Observable } from 'rxjs/rx';
import { Disposable } from 'vscode';
import { createDeferred } from '../../helpers';
import { DEFAULT_ENCODING } from './constants';
import { ExecutionResult, IBufferDecoder, IProcessService, ObservableExecutionResult, Output, SpawnOptions } from './types';

export class ProcessService implements IProcessService {
    constructor(private decoder: IBufferDecoder) { }
    public execObservable(file: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : DEFAULT_ENCODING;
        const proc = spawn(file, args, options);
        let procExited = false;

        const output = new Observable<Output<string>>(subscriber => {
            const disposables: Disposable[] = [];

            const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
                ee.on(name, fn);
                disposables.push({ dispose: () => ee.removeListener(name, fn) });
            };

            if (options.cancellationToken) {
                disposables.push(options.cancellationToken.onCancellationRequested(() => {
                    if (procExited && !proc.killed) {
                        proc.kill();
                        procExited = true;
                    }
                }));
            }

            const sendOutput = (source: 'stdout' | 'stderr', data: Buffer) => {
                source = options.mergeStdOutErr ? 'stdout' : source;
                subscriber.next({ source, out: this.decoder.decode([data], encoding) });
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
    public async exec(file: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : DEFAULT_ENCODING;
        const proc = spawn(file, args, options);
        const deferred = createDeferred<ExecutionResult<string>>();
        const disposables: Disposable[] = [];

        const on = (ee: NodeJS.EventEmitter, name: string, fn: Function) => {
            ee.on(name, fn);
            disposables.push({ dispose: () => ee.removeListener(name, fn) });
        };

        if (options.cancellationToken) {
            disposables.push(options.cancellationToken.onCancellationRequested(() => {
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
            const stderr = this.decoder.decode(stderrBuffers, encoding);
            if (stderr.length > 0 && options.throwOnStdErr) {
                deferred.reject(stderr);
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
