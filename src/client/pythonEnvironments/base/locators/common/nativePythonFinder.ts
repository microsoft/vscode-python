// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, EventEmitter, Event, Uri, LogOutputChannel } from 'vscode';
import * as ch from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { PassThrough } from 'stream';
import { isWindows } from '../../../../common/platform/platformService';
import { EXTENSION_ROOT_DIR } from '../../../../constants';
import { createDeferred, createDeferredFrom } from '../../../../common/utils/async';
import { DisposableBase, DisposableStore } from '../../../../common/utils/resourceLifecycle';
import { noop } from '../../../../common/utils/misc';
import { getConfiguration, getWorkspaceFolderPaths } from '../../../../common/vscodeApis/workspaceApis';
import { CONDAPATH_SETTING_KEY } from '../../../common/environmentManagers/conda';
import { VENVFOLDERS_SETTING_KEY, VENVPATH_SETTING_KEY } from '../lowLevel/customVirtualEnvLocator';
import { getUserHomeDir } from '../../../../common/utils/platform';
import { createLogOutputChannel } from '../../../../common/vscodeApis/windowApis';
import { PythonEnvKind } from '../../info';
import { sendNativeTelemetry, NativePythonTelemetry } from './nativePythonTelemetry';
import { traceError } from '../../../../logging';

const untildify = require('untildify');

const PYTHON_ENV_TOOLS_PATH = isWindows()
    ? path.join(EXTENSION_ROOT_DIR, 'python-env-tools', 'bin', 'pet.exe')
    : path.join(EXTENSION_ROOT_DIR, 'python-env-tools', 'bin', 'pet');

export interface NativeEnvInfo {
    displayName?: string;
    name?: string;
    executable?: string;
    kind?: PythonEnvironmentKind;
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

export enum PythonEnvironmentKind {
    Conda = 'Conda',
    Homebrew = 'Homebrew',
    Pyenv = 'Pyenv',
    GlobalPaths = 'GlobalPaths',
    PyenvVirtualEnv = 'PyenvVirtualEnv',
    Pipenv = 'Pipenv',
    Poetry = 'Poetry',
    MacPythonOrg = 'MacPythonOrg',
    MacCommandLineTools = 'MacCommandLineTools',
    LinuxGlobal = 'LinuxGlobal',
    MacXCode = 'MacXCode',
    Venv = 'Venv',
    VirtualEnv = 'VirtualEnv',
    VirtualEnvWrapper = 'VirtualEnvWrapper',
    WindowsStore = 'WindowsStore',
    WindowsRegistry = 'WindowsRegistry',
}

export interface NativeEnvManagerInfo {
    tool: string;
    executable: string;
    version?: string;
}

export function isNativeInfoEnvironment(info: NativeEnvInfo | NativeEnvManagerInfo): info is NativeEnvInfo {
    if ((info as NativeEnvManagerInfo).tool) {
        return false;
    }
    return true;
}

export type NativeCondaInfo = {
    canSpawnConda: boolean;
    userProvidedEnvFound?: boolean;
    condaRcs: string[];
    envDirs: string[];
    environmentsTxt?: string;
    environmentsTxtExists?: boolean;
    environmentsFromTxt: string[];
};

export interface NativePythonFinder extends Disposable {
    /**
     * Refresh the list of python environments.
     * Returns an async iterable that can be used to iterate over the list of python environments.
     * Internally this will take all of the current workspace folders and search for python environments.
     *
     * If a Uri is provided, then it will search for python environments in that location (ignoring workspaces).
     * Uri can be a file or a folder.
     * If a PythonEnvironmentKind is provided, then it will search for python environments of that kind (ignoring workspaces).
     */
    refresh(options?: PythonEnvironmentKind | Uri[]): AsyncIterable<NativeEnvInfo | NativeEnvManagerInfo>;
    /**
     * Will spawn the provided Python executable and return information about the environment.
     * @param executable
     */
    resolve(executable: string): Promise<NativeEnvInfo>;
    categoryToKind(category?: PythonEnvironmentKind): PythonEnvKind;
    /**
     * Used only for telemetry.
     */
    getCondaInfo(): Promise<NativeCondaInfo>;
}

const mapping = new Map<PythonEnvironmentKind, PythonEnvKind>([
    [PythonEnvironmentKind.Conda, PythonEnvKind.Conda],
    [PythonEnvironmentKind.GlobalPaths, PythonEnvKind.OtherGlobal],
    [PythonEnvironmentKind.Pyenv, PythonEnvKind.Pyenv],
    [PythonEnvironmentKind.PyenvVirtualEnv, PythonEnvKind.Pyenv],
    [PythonEnvironmentKind.Pipenv, PythonEnvKind.Pipenv],
    [PythonEnvironmentKind.Poetry, PythonEnvKind.Poetry],
    [PythonEnvironmentKind.VirtualEnv, PythonEnvKind.VirtualEnv],
    [PythonEnvironmentKind.VirtualEnvWrapper, PythonEnvKind.VirtualEnvWrapper],
    [PythonEnvironmentKind.Venv, PythonEnvKind.Venv],
    [PythonEnvironmentKind.WindowsRegistry, PythonEnvKind.System],
    [PythonEnvironmentKind.WindowsStore, PythonEnvKind.MicrosoftStore],
    [PythonEnvironmentKind.Homebrew, PythonEnvKind.System],
    [PythonEnvironmentKind.LinuxGlobal, PythonEnvKind.System],
    [PythonEnvironmentKind.MacCommandLineTools, PythonEnvKind.System],
    [PythonEnvironmentKind.MacPythonOrg, PythonEnvKind.System],
    [PythonEnvironmentKind.MacXCode, PythonEnvKind.System],
]);

export function categoryToKind(category?: PythonEnvironmentKind, logger?: LogOutputChannel): PythonEnvKind {
    if (!category) {
        return PythonEnvKind.Unknown;
    }
    const kind = mapping.get(category);
    if (kind) {
        return kind;
    }

    if (logger) {
        logger.error(`Unknown Python Environment category '${category}' from Native Locator.`);
    } else {
        traceError(`Unknown Python Environment category '${category}' from Native Locator.`);
    }
    return PythonEnvKind.Unknown;
}

interface NativeLog {
    level: string;
    message: string;
}

class NativeGlobalPythonFinderImpl extends DisposableBase implements NativePythonFinder {
    private readonly connection: rpc.MessageConnection;

    private firstRefreshResults: undefined | (() => AsyncGenerator<NativeEnvInfo, void, unknown>);

    private readonly outputChannel = this._register(createLogOutputChannel('Python Locator', { log: true }));

    constructor() {
        super();
        this.connection = this.start();
        void this.configure();
        this.firstRefreshResults = this.refreshFirstTime();
    }

    public async resolve(executable: string): Promise<NativeEnvInfo> {
        await this.configure();
        const environment = await this.connection.sendRequest<NativeEnvInfo>('resolve', {
            executable,
        });

        this.outputChannel.info(`Resolved Python Environment ${environment.executable}`);
        return environment;
    }

    categoryToKind(category?: PythonEnvironmentKind): PythonEnvKind {
        return categoryToKind(category, this.outputChannel);
    }

    async *refresh(options?: PythonEnvironmentKind | Uri[]): AsyncIterable<NativeEnvInfo> {
        if (this.firstRefreshResults) {
            // If this is the first time we are refreshing,
            // Then get the results from the first refresh.
            // Those would have started earlier and cached in memory.
            const results = this.firstRefreshResults();
            this.firstRefreshResults = undefined;
            yield* results;
        } else {
            const result = this.doRefresh(options);
            let completed = false;
            void result.completed.finally(() => {
                completed = true;
            });
            const envs: (NativeEnvInfo | NativeEnvManagerInfo)[] = [];
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
            connection.onNotification('telemetry', (data: NativePythonTelemetry) => sendNativeTelemetry(data)),
            connection.onClose(() => {
                disposables.forEach((d) => d.dispose());
            }),
        );

        connection.listen();
        this._register(Disposable.from(...disposables));
        return connection;
    }

    private doRefresh(
        options?: PythonEnvironmentKind | Uri[],
    ): { completed: Promise<void>; discovered: Event<NativeEnvInfo | NativeEnvManagerInfo> } {
        const disposable = this._register(new DisposableStore());
        const discovered = disposable.add(new EventEmitter<NativeEnvInfo | NativeEnvManagerInfo>());
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

        // Assumption is server will ensure there's only one refresh at a time.
        // Perhaps we should have a request Id or the like to map the results back to the `refresh` request.
        disposable.add(
            this.connection.onNotification('environment', (data: NativeEnvInfo) => {
                this.outputChannel.info(`Discovered env: ${data.executable || data.prefix}`);
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
                        .sendRequest<NativeEnvInfo>('resolve', {
                            executable: data.executable,
                        })
                        .then((environment) => {
                            this.outputChannel.info(`Resolved ${environment.executable}`);
                            discovered.fire(environment);
                        })
                        .catch((ex) => this.outputChannel.error(`Error in Resolving ${JSON.stringify(data)}`, ex));
                    trackPromiseAndNotifyOnCompletion(promise);
                } else {
                    discovered.fire(data);
                }
            }),
        );
        disposable.add(
            this.connection.onNotification('manager', (data: NativeEnvManagerInfo) => {
                this.outputChannel.info(`Discovered manager: (${data.tool}) ${data.executable}`);
                discovered.fire(data);
            }),
        );

        type RefreshOptions = {
            searchKind?: PythonEnvironmentKind;
            searchPaths?: string[];
        };

        const refreshOptions: RefreshOptions = {};
        if (options && Array.isArray(options) && options.length > 0) {
            refreshOptions.searchPaths = options.map((item) => item.fsPath);
        } else if (options && typeof options === 'string') {
            refreshOptions.searchKind = options;
        }
        trackPromiseAndNotifyOnCompletion(
            this.configure().then(() =>
                this.connection
                    .sendRequest<{ duration: number }>('refresh', refreshOptions)
                    .then(({ duration }) => this.outputChannel.info(`Refresh completed in ${duration}ms`))
                    .catch((ex) => this.outputChannel.error('Refresh error', ex)),
            ),
        );

        completed.promise.finally(() => disposable.dispose());
        return {
            completed: completed.promise,
            discovered: discovered.event,
        };
    }

    private lastConfiguration?: ConfigurationOptions;

    /**
     * Configuration request, this must always be invoked before any other request.
     * Must be invoked when ever there are changes to any data related to the configuration details.
     */
    private async configure() {
        const options: ConfigurationOptions = {
            workspaceDirectories: getWorkspaceFolderPaths(),
            // We do not want to mix this with `search_paths`
            environmentDirectories: getCustomVirtualEnvDirs(),
            condaExecutable: getPythonSettingAndUntildify<string>(CONDAPATH_SETTING_KEY),
            poetryExecutable: getPythonSettingAndUntildify<string>('poetryPath'),
        };
        // No need to send a configuration request, is there are no changes.
        if (JSON.stringify(options) === JSON.stringify(this.lastConfiguration || {})) {
            return;
        }
        try {
            this.lastConfiguration = options;
            await this.connection.sendRequest('configure', options);
        } catch (ex) {
            this.outputChannel.error('Refresh error', ex);
        }
    }

    async getCondaInfo(): Promise<NativeCondaInfo> {
        return this.connection.sendRequest<NativeCondaInfo>('condaInfo');
    }
}

type ConfigurationOptions = {
    workspaceDirectories: string[];
    /**
     * Place where virtual envs and the like are stored
     * Should not contain workspace folders.
     */
    environmentDirectories: string[];
    condaExecutable: string | undefined;
    poetryExecutable: string | undefined;
    cacheDirectory?: string;
};
/**
 * Gets all custom virtual environment locations to look for environments.
 */
function getCustomVirtualEnvDirs(): string[] {
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

let _finder: NativePythonFinder | undefined;
export function getNativePythonFinder(): NativePythonFinder {
    if (!_finder) {
        _finder = new NativeGlobalPythonFinderImpl();
    }
    return _finder;
}
