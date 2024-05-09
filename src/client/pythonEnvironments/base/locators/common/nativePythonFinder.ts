// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, Disposable, Event, EventEmitter } from 'vscode';
import * as ch from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { PassThrough } from 'stream';
import { isWindows } from '../../../../common/platform/platformService';
import { EXTENSION_ROOT_DIR } from '../../../../constants';
import { traceError, traceInfo, traceLog, traceVerbose, traceWarn } from '../../../../logging';
import { createDeferred } from '../../../../common/utils/async';

const NATIVE_LOCATOR = isWindows()
    ? path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'python-finder.exe')
    : path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'python-finder');

export interface NativeEnvInfo {
    name: string;
    pythonExecutablePath?: string;
    category: string;
    version?: string;
    pythonRunCommand?: string[];
    envPath?: string;
    sysPrefixPath?: string;
    /**
     * Path to the project directory when dealing with pipenv virtual environments.
     */
    projectPath?: string;
}

export interface NativeEnvManagerInfo {
    tool: string;
    executablePath: string;
    version?: string;
}

export interface NativeGlobalPythonFinder extends Disposable {
    startSearch(token?: CancellationToken): Promise<void>;
    onDidFindPythonEnvironment: Event<NativeEnvInfo>;
    onDidFindEnvironmentManager: Event<NativeEnvManagerInfo>;
}

interface NativeLog {
    level: string;
    message: string;
}

class NativeGlobalPythonFinderImpl implements NativeGlobalPythonFinder {
    private readonly _onDidFindPythonEnvironment = new EventEmitter<NativeEnvInfo>();

    private readonly _onDidFindEnvironmentManager = new EventEmitter<NativeEnvManagerInfo>();

    public readonly onDidFindPythonEnvironment = this._onDidFindPythonEnvironment.event;

    public readonly onDidFindEnvironmentManager = this._onDidFindEnvironmentManager.event;

    public startSearch(token?: CancellationToken): Promise<void> {
        const deferred = createDeferred<void>();
        const proc = ch.spawn(NATIVE_LOCATOR, [], { env: process.env });
        const disposables: Disposable[] = [];

        // jsonrpc package cannot handle messages coming through too quicly.
        // Lets handle the messages and close the stream only when
        // we have got the exit event.
        const readable = new PassThrough();
        proc.stdout.pipe(readable, { end: false });
        const writable = new PassThrough();
        writable.pipe(proc.stdin, { end: false });
        const disposeStreams = new Disposable(() => {
            readable.end();
            readable.destroy();
            writable.end();
            writable.destroy();
        });
        const connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(readable),
            new rpc.StreamMessageWriter(writable),
        );

        disposables.push(
            connection,
            disposeStreams,
            connection.onError((ex) => {
                disposeStreams.dispose();
                traceError('Error in Native Python Finder', ex);
            }),
            connection.onNotification('pythonEnvironment', (data: NativeEnvInfo) => {
                this._onDidFindPythonEnvironment.fire(data);
            }),
            connection.onNotification('envManager', (data: NativeEnvManagerInfo) => {
                this._onDidFindEnvironmentManager.fire(data);
            }),
            connection.onNotification('exit', () => {
                traceInfo('Native Python Finder exited');
                disposeStreams.dispose();
            }),
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
                deferred.resolve();
                disposables.forEach((d) => d.dispose());
            }),
            {
                dispose: () => {
                    try {
                        if (proc.exitCode === null) {
                            proc.kill();
                        }
                    } catch (err) {
                        traceVerbose('Error while disposing Native Python Finder', err);
                    }
                },
            },
        );

        if (token) {
            disposables.push(
                token.onCancellationRequested(() => {
                    deferred.resolve();
                    try {
                        proc.kill();
                    } catch (err) {
                        traceVerbose('Error while handling cancellation request for Native Python Finder', err);
                    }
                }),
            );
        }

        connection.listen();
        return deferred.promise;
    }

    public dispose() {
        this._onDidFindPythonEnvironment.dispose();
        this._onDidFindEnvironmentManager.dispose();
    }
}

export function createNativeGlobalPythonFinder(): NativeGlobalPythonFinder {
    return new NativeGlobalPythonFinderImpl();
}
