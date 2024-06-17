// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, EventEmitter, Event, Uri, workspace } from 'vscode';
import * as ch from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { PassThrough } from 'stream';
import { isWindows } from '../../../../common/platform/platformService';
import { EXTENSION_ROOT_DIR } from '../../../../constants';
import { traceError, traceInfo, traceLog, traceVerbose, traceWarn } from '../../../../logging';
import { createDeferred } from '../../../../common/utils/async';
import { DisposableBase } from '../../../../common/utils/resourceLifecycle';

const NATIVE_LOCATOR = isWindows()
    ? path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'pet.exe')
    : path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'pet');

export interface NativeEnvInfo {
    displayName?: string;
    name?: string;
    executable?: string;
    category: string;
    version?: string;
    prefix?: string;
    manager?: NativeEnvManagerInfo;
    /**
     * Path to the project directory when dealing with pipenv virtual environments.
     */
    project?: string;
    arch?: 'x64' | 'x86';
    symlinks?: string[];
}

export interface NativeEnvManagerInfo {
    tool: string;
    executable: string;
    version?: string;
}

export interface NativeGlobalPythonFinder extends Disposable {
    refresh(paths: Uri[]): AsyncIterable<NativeEnvInfo>;
}

interface NativeLog {
    level: string;
    message: string;
}

class NativeGlobalPythonFinderImpl extends DisposableBase implements NativeGlobalPythonFinder {
    async *refresh(_paths: Uri[]): AsyncIterable<NativeEnvInfo> {
        const result = this.start();
        let completed = false;
        void result.completed.finally(() => {
            completed = true;
        });
        const envs: NativeEnvInfo[] = [];
        let discovered = createDeferred();
        const disposable = result.discovered((data) => envs.push(data));

        do {
            await Promise.race([result.completed, discovered.promise]);
            if (envs.length) {
                const dataToSend = [...envs];
                envs.length = 0;
                for (const data of dataToSend) {
                    yield data;
                }
            }
            if (!completed) {
                discovered = createDeferred();
                envs.length = 0;
            }
        } while (!completed);

        disposable.dispose();
    }

    // eslint-disable-next-line class-methods-use-this
    private start(): { completed: Promise<void>; discovered: Event<NativeEnvInfo> } {
        const discovered = new EventEmitter<NativeEnvInfo>();
        const completed = createDeferred<void>();
        const proc = ch.spawn(NATIVE_LOCATOR, ['server'], { env: process.env });
        const disposables: Disposable[] = [];
        // jsonrpc package cannot handle messages coming through too quicly.
        // Lets handle the messages and close the stream only when
        // we have got the exit event.
        const readable = new PassThrough();
        proc.stdout.pipe(readable, { end: false });
        let err = '';
        proc.stderr.on('data', (data) => {
            err += data.toString();
            traceError('Native Python Finder', err);
        });
        const writable = new PassThrough();
        writable.pipe(proc.stdin, { end: false });
        const disposeStreams = new Disposable(() => {
            readable.end();
            writable.end();
        });
        const connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(readable),
            new rpc.StreamMessageWriter(writable),
        );
        disposables.push(
            connection,
            disposeStreams,
            discovered,
            connection.onError((ex) => {
                disposeStreams.dispose();
                traceError('Error in Native Python Finder', ex);
            }),
            connection.onNotification('environment', (data: NativeEnvInfo) => {
                discovered.fire(data);
            }),
            // connection.onNotification((method: string, data: any) => {
            //     console.log(method, data);
            // }),
            connection.onNotification('log', (data: NativeLog) => {
                switch (data.level) {
                    case 'info':
                        traceInfo(`Native Python Finder: ${data.message}`);
                        break;
                    case 'warning':
                        traceWarn(`Native Python Finder: ${data.message}`);
                        break;
                    case 'error':
                        traceError(`Native Python Finder: ${data.message}`);
                        break;
                    case 'debug':
                        traceVerbose(`Native Python Finder: ${data.message}`);
                        break;
                    default:
                        traceLog(`Native Python Finder: ${data.message}`);
                }
            }),
            connection.onClose(() => {
                completed.resolve();
                disposables.forEach((d) => d.dispose());
            }),
            {
                dispose: () => {
                    try {
                        if (proc.exitCode === null) {
                            proc.kill();
                        }
                    } catch (ex) {
                        traceVerbose('Error while disposing Native Python Finder', ex);
                    }
                },
            },
        );

        connection.listen();
        connection
            .sendRequest<number>('refresh', {
                // Send configuration information to the Python finder.
                search_paths: (workspace.workspaceFolders || []).map((w) => w.uri.fsPath),
                conda_executable: undefined,
            })
            .then((durationInMilliSeconds: number) => {
                completed.resolve();
                traceInfo(`Native Python Finder took ${durationInMilliSeconds}ms to complete.`);
            })
            .catch((ex) => traceError('Error in Native Python Finder', ex));

        return { completed: completed.promise, discovered: discovered.event };
    }
}

export function createNativeGlobalPythonFinder(): NativeGlobalPythonFinder {
    return new NativeGlobalPythonFinderImpl();
}
