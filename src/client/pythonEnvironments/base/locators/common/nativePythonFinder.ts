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
import { DisposableBase, DisposableStore } from '../../../../common/utils/resourceLifecycle';
import { getPythonSetting } from '../../../common/externalDependencies';
import { DEFAULT_INTERPRETER_PATH_SETTING_KEY } from '../lowLevel/customWorkspaceLocator';
import { noop } from '../../../../common/utils/misc';

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
    resolve(executable: string): Promise<NativeEnvInfo>;
    refresh(paths: Uri[]): AsyncIterable<NativeEnvInfo>;
}

interface NativeLog {
    level: string;
    message: string;
}

class NativeGlobalPythonFinderImpl extends DisposableBase implements NativeGlobalPythonFinder {
    private readonly connection: rpc.MessageConnection;

    constructor() {
        super();
        this.connection = this.start();
    }

    public async resolve(executable: string): Promise<NativeEnvInfo> {
        const { environment, duration } = await this.connection.sendRequest<{
            duration: number;
            environment: NativeEnvInfo;
        }>('resolve', {
            executable,
        });

        traceInfo(`Resolved Python Environment ${environment.executable} in ${duration}ms`);
        return environment;
    }

    async *refresh(_paths: Uri[]): AsyncIterable<NativeEnvInfo> {
        const result = this.doRefresh();
        let completed = false;
        void result.completed.finally(() => {
            completed = true;
        });
        const envs: NativeEnvInfo[] = [];
        let discovered = createDeferred();
        const disposable = result.discovered((data) => {
            envs.push(data);
            discovered.resolve();
        });
        do {
            if (!envs.length) {
                await Promise.race([result.completed, discovered.promise]);
            }
            if (envs.length) {
                const dataToSend = [...envs];
                envs.length = 0;
                for (const data of dataToSend) {
                    yield data;
                }
            }
            if (!completed) {
                discovered = createDeferred();
            }
        } while (!completed);
        disposable.dispose();
    }

    // eslint-disable-next-line class-methods-use-this
    private start(): rpc.MessageConnection {
        const proc = ch.spawn(NATIVE_LOCATOR, ['server'], { env: process.env });
        const disposables: Disposable[] = [];
        // jsonrpc package cannot handle messages coming through too quicly.
        // Lets handle the messages and close the stream only when
        // we have got the exit event.
        const readable = new PassThrough();
        proc.stdout.pipe(readable, { end: false });
        proc.stderr.on('data', (data) => {
            const err = data.toString();
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
            connection.onError((ex) => {
                disposeStreams.dispose();
                traceError('Error in Native Python Finder', ex);
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
        this._register(Disposable.from(...disposables));
        return connection;
    }

    private doRefresh(): { completed: Promise<void>; discovered: Event<NativeEnvInfo> } {
        const disposable = this._register(new DisposableStore());
        const discovered = disposable.add(new EventEmitter<NativeEnvInfo>());
        const completed = createDeferred<void>();
        const pendingPromises: Promise<void>[] = [];

        const notifyUponCompletion = () => {
            const initialCount = pendingPromises.length;
            Promise.all(pendingPromises)
                .then(() => {
                    if (initialCount === pendingPromises.length) {
                        completed.resolve();
                    } else {
                        setTimeout(notifyUponCompletion, 0);
                    }
                })
                .catch(noop);
        };
        const trackPromiseAndNotifyOnCompletion = (promise: Promise<void>) => {
            pendingPromises.push(promise);
            notifyUponCompletion();
        };

        disposable.add(
            this.connection.onNotification('environment', (data: NativeEnvInfo) => {
                // We know that in the Python extension if either Version of Prefix is not provided by locator
                // Then we end up resolving the information.
                // Lets do that here,
                // This is a hack, as the other part of the code that resolves the version information
                // doesn't work as expected, as its still a WIP.
                if (data.executable && (!data.version || !data.prefix)) {
                    // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                    // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                    // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                    // HACK = TEMPORARY WORK AROUND, TO GET STUFF WORKING
                    const promise = this.connection
                        .sendRequest<{ duration: number; environment: NativeEnvInfo }>('resolve', {
                            executable: data.executable,
                        })
                        .then(({ environment, duration }) => {
                            traceInfo(`Resolved Python Environment ${environment.executable} in ${duration}ms`);
                            discovered.fire(environment);
                        })
                        .catch((ex) => traceError(`Error in Resolving Python Environment ${data}`, ex));
                    trackPromiseAndNotifyOnCompletion(promise);
                } else {
                    discovered.fire(data);
                }
            }),
        );

        const pythonPathSettings = (workspace.workspaceFolders || []).map((w) =>
            getPythonSetting<string>(DEFAULT_INTERPRETER_PATH_SETTING_KEY, w.uri.fsPath),
        );
        pythonPathSettings.push(getPythonSetting<string>(DEFAULT_INTERPRETER_PATH_SETTING_KEY));
        const pythonSettings = Array.from(new Set(pythonPathSettings.filter((item) => !!item)).values()).map((p) =>
            // We only want the parent directories.
            path.dirname(p!),
        );
        trackPromiseAndNotifyOnCompletion(
            this.connection
                .sendRequest<{ duration: number }>('refresh', {
                    // Send configuration information to the Python finder.
                    search_paths: (workspace.workspaceFolders || []).map((w) => w.uri.fsPath),
                    // Also send the python paths that are configured in the settings.
                    python_path_settings: pythonSettings,
                    conda_executable: undefined,
                })
                .then(({ duration }) => traceInfo(`Native Python Finder completed in ${duration}ms`))
                .catch((ex) => traceError('Error in Native Python Finder', ex)),
        );
        completed.promise.finally(() => disposable.dispose());
        return {
            completed: completed.promise,
            discovered: discovered.event,
        };
    }
}

export function createNativeGlobalPythonFinder(): NativeGlobalPythonFinder {
    return new NativeGlobalPythonFinderImpl();
}
