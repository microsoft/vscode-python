// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, EventEmitter, Event, Uri } from 'vscode';
import * as ch from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { PassThrough } from 'stream';
import { isWindows } from '../../../../common/platform/platformService';
import { EXTENSION_ROOT_DIR } from '../../../../constants';
import { createDeferred, createDeferredFrom } from '../../../../common/utils/async';
import { DisposableBase, DisposableStore } from '../../../../common/utils/resourceLifecycle';
import { DEFAULT_INTERPRETER_PATH_SETTING_KEY } from '../lowLevel/customWorkspaceLocator';
import { noop } from '../../../../common/utils/misc';
import {
    getConfiguration,
    getWorkspaceFolderPaths,
    getWorkspaceFolders,
} from '../../../../common/vscodeApis/workspaceApis';
import { CONDAPATH_SETTING_KEY } from '../../../common/environmentManagers/conda';
import { VENVFOLDERS_SETTING_KEY, VENVPATH_SETTING_KEY } from '../lowLevel/customVirtualEnvLocator';
import { getUserHomeDir } from '../../../../common/utils/platform';
import { createLogOutputChannel } from '../../../../common/vscodeApis/windowApis';
import { PythonEnvKind } from '../../info';

const untildify = require('untildify');

const PYTHON_ENV_TOOLS_PATH = isWindows()
    ? path.join(EXTENSION_ROOT_DIR, 'python-env-tools', 'bin', 'pet.exe')
    : path.join(EXTENSION_ROOT_DIR, 'python-env-tools', 'bin', 'pet');

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
    refresh(): AsyncIterable<NativeEnvInfo>;
    categoryToKind(category: string): PythonEnvKind;
}

interface NativeLog {
    level: string;
    message: string;
}

class NativeGlobalPythonFinderImpl extends DisposableBase implements NativeGlobalPythonFinder {
    private readonly connection: rpc.MessageConnection;

    private firstRefreshResults: undefined | (() => AsyncGenerator<NativeEnvInfo, void, unknown>);

    private readonly outputChannel = this._register(createLogOutputChannel('Python Locator', { log: true }));

    constructor() {
        super();
        this.connection = this.start();
        this.firstRefreshResults = this.refreshFirstTime();
    }

    public async resolve(executable: string): Promise<NativeEnvInfo> {
        const { environment, duration } = await this.connection.sendRequest<{
            duration: number;
            environment: NativeEnvInfo;
        }>('resolve', {
            executable,
        });

        this.outputChannel.info(`Resolved Python Environment ${environment.executable} in ${duration}ms`);
        return environment;
    }

    categoryToKind(category: string): PythonEnvKind {
        switch (category.toLowerCase()) {
            case 'conda':
                return PythonEnvKind.Conda;
            case 'system':
            case 'homebrew':
            case 'mac-python-org':
            case 'mac-command-line-tools':
            case 'mac-xcode':
            case 'windows-registry':
                return PythonEnvKind.System;
            case 'pyenv':
            case 'pyenv-other':
                return PythonEnvKind.Pyenv;
            case 'poetry':
                return PythonEnvKind.Poetry;
            case 'pipenv':
                return PythonEnvKind.Pipenv;
            case 'pyenv-virtualenv':
                return PythonEnvKind.VirtualEnv;
            case 'venv':
                return PythonEnvKind.Venv;
            case 'virtualenv':
                return PythonEnvKind.VirtualEnv;
            case 'virtualenvwrapper':
                return PythonEnvKind.VirtualEnvWrapper;
            case 'windows-store':
                return PythonEnvKind.MicrosoftStore;
            case 'unknown':
                return PythonEnvKind.Unknown;
            default: {
                this.outputChannel.info(`Unknown Python Environment category '${category}' from Native Locator.`);
                return PythonEnvKind.Unknown;
            }
        }
    }

    async *refresh(): AsyncIterable<NativeEnvInfo> {
        if (this.firstRefreshResults) {
            // If this is the first time we are refreshing,
            // Then get the results from the first refresh.
            // Those would have started earlier and cached in memory.
            const results = this.firstRefreshResults();
            this.firstRefreshResults = undefined;
            yield* results;
        } else {
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
    }

    refreshFirstTime() {
        const result = this.doRefresh();
        const completed = createDeferredFrom(result.completed);
        const envs: NativeEnvInfo[] = [];
        let discovered = createDeferred();
        const disposable = result.discovered((data) => {
            envs.push(data);
            discovered.resolve();
        });

        const iterable = async function* () {
            do {
                if (!envs.length) {
                    await Promise.race([completed.promise, discovered.promise]);
                }
                if (envs.length) {
                    const dataToSend = [...envs];
                    envs.length = 0;
                    for (const data of dataToSend) {
                        yield data;
                    }
                }
                if (!completed.completed) {
                    discovered = createDeferred();
                }
            } while (!completed.completed);
            disposable.dispose();
        };

        return iterable.bind(this);
    }

    // eslint-disable-next-line class-methods-use-this
    private start(): rpc.MessageConnection {
        this.outputChannel.info(`Starting Python Locator ${PYTHON_ENV_TOOLS_PATH} server`);

        // jsonrpc package cannot handle messages coming through too quickly.
        // Lets handle the messages and close the stream only when
        // we have got the exit event.
        const readable = new PassThrough();
        const writable = new PassThrough();
        const disposables: Disposable[] = [];
        try {
            const proc = ch.spawn(PYTHON_ENV_TOOLS_PATH, ['server'], { env: process.env });
            proc.stdout.pipe(readable, { end: false });
            proc.stderr.on('data', (data) => this.outputChannel.error(data.toString()));
            writable.pipe(proc.stdin, { end: false });

            disposables.push({
                dispose: () => {
                    try {
                        if (proc.exitCode === null) {
                            proc.kill();
                        }
                    } catch (ex) {
                        this.outputChannel.error('Error disposing finder', ex);
                    }
                },
            });
        } catch (ex) {
            this.outputChannel.error(`Error starting Python Finder ${PYTHON_ENV_TOOLS_PATH} server`, ex);
        }
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
                this.outputChannel.error('Connection Error:', ex);
            }),
            connection.onNotification('log', (data: NativeLog) => {
                switch (data.level) {
                    case 'info':
                        this.outputChannel.info(data.message);
                        break;
                    case 'warning':
                        this.outputChannel.warn(data.message);
                        break;
                    case 'error':
                        this.outputChannel.error(data.message);
                        break;
                    case 'debug':
                        this.outputChannel.debug(data.message);
                        break;
                    default:
                        this.outputChannel.trace(data.message);
                }
            }),
            connection.onClose(() => {
                disposables.forEach((d) => d.dispose());
            }),
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
                this.outputChannel.info(`Discovered env: ${data.executable || data.executable}`);
                this.outputChannel.trace(`Discovered env info:\n ${JSON.stringify(data, undefined, 4)}`);
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
                            this.outputChannel.info(`Resolved ${environment.executable} in ${duration}ms`);
                            this.outputChannel.trace(`Environment resolved:\n ${JSON.stringify(data, undefined, 4)}`);
                            discovered.fire(environment);
                        })
                        .catch((ex) => this.outputChannel.error(`Error in Resolving ${JSON.stringify(data)}`, ex));
                    trackPromiseAndNotifyOnCompletion(promise);
                } else {
                    discovered.fire(data);
                }
            }),
        );

        trackPromiseAndNotifyOnCompletion(
            this.sendRefreshRequest()
                .then(({ duration }) => this.outputChannel.info(`Refresh completed in ${duration}ms`))
                .catch((ex) => this.outputChannel.error('Refresh error', ex)),
        );

        completed.promise.finally(() => disposable.dispose());
        return {
            completed: completed.promise,
            discovered: discovered.event,
        };
    }

    private sendRefreshRequest() {
        const pythonPathSettings = (getWorkspaceFolders() || []).map((w) =>
            getPythonSettingAndUntildify<string>(DEFAULT_INTERPRETER_PATH_SETTING_KEY, w.uri),
        );
        pythonPathSettings.push(getPythonSettingAndUntildify<string>(DEFAULT_INTERPRETER_PATH_SETTING_KEY));
        // We can have multiple workspaces, each with its own setting.
        const pythonSettings = Array.from(
            new Set(
                pythonPathSettings
                    .filter((item) => !!item)
                    // We only want the parent directories.
                    .map((p) => path.dirname(p!))
                    /// If setting value is 'python', then `path.dirname('python')` will yield `.`
                    .filter((item) => item !== '.'),
            ),
        );

        return this.connection.sendRequest<{ duration: number }>(
            'refresh',
            // Send configuration information to the Python finder.
            {
                // This has a special meaning in locator, its lot a low priority
                // as we treat this as workspace folders that can contain a large number of files.
                search_paths: getWorkspaceFolderPaths(),
                // Also send the python paths that are configured in the settings.
                python_interpreter_paths: pythonSettings,
                // We do not want to mix this with `search_paths`
                virtual_env_paths: getCustomVirtualEnvDirs(),
                conda_executable: getPythonSettingAndUntildify<string>(CONDAPATH_SETTING_KEY),
                poetry_executable: getPythonSettingAndUntildify<string>('poetryPath'),
                pipenv_executable: getPythonSettingAndUntildify<string>('pipenvPath'),
            },
        );
    }
}

/**
 * Gets all custom virtual environment locations to look for environments.
 */
async function getCustomVirtualEnvDirs(): Promise<string[]> {
    const venvDirs: string[] = [];
    const venvPath = getPythonSettingAndUntildify<string>(VENVPATH_SETTING_KEY);
    if (venvPath) {
        venvDirs.push(untildify(venvPath));
    }
    const venvFolders = getPythonSettingAndUntildify<string[]>(VENVFOLDERS_SETTING_KEY) ?? [];
    const homeDir = getUserHomeDir();
    if (homeDir) {
        venvFolders.map((item) => path.join(homeDir, item)).forEach((d) => venvDirs.push(d));
    }
    return Array.from(new Set(venvDirs));
}

function getPythonSettingAndUntildify<T>(name: string, scope?: Uri): T | undefined {
    const value = getConfiguration('python', scope).get<T>(name);
    if (typeof value === 'string') {
        return value ? ((untildify(value as string) as unknown) as T) : undefined;
    }
    return value;
}

export function createNativeGlobalPythonFinder(): NativeGlobalPythonFinder {
    return new NativeGlobalPythonFinderImpl();
}
