// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, unmanaged } from 'inversify';
import * as path from 'path';
import { CancellationToken, CancellationTokenSource, Progress, ProgressLocation, ProgressOptions } from 'vscode';

import { IApplicationShell, IWorkspaceService } from '../../../common/application/types';
import { Cancellation, createPromiseFromCancellation, wrapCancellationTokens } from '../../../common/cancellation';
import { traceError, traceInfo, traceWarning } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import {
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService,
    SpawnOptions
} from '../../../common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IPersistentState,
    IPersistentStateFactory
} from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import * as localize from '../../../common/utils/localize';
import { StopWatch } from '../../../common/utils/stopWatch';
import {
    IInterpreterService,
    IKnownSearchPathsForInterpreters,
    PythonInterpreter
} from '../../../interpreter/contracts';
import { sendTelemetryEvent } from '../../../telemetry';
import { JupyterCommands, PythonDaemonModule, RegExpValues, Telemetry } from '../../constants';
import { IJupyterCommand, IJupyterCommandFactory } from '../../types';

export enum ModuleExistsStatus {
    NotFound,
    FoundJupyter,
    Found
}

interface IModuleExistsResult {
    status: ModuleExistsStatus;
    error?: string;
}

export interface IFindCommandResult extends IModuleExistsResult {
    command?: IJupyterCommand;
}

const cancelledResult: IFindCommandResult = {
    status: ModuleExistsStatus.NotFound,
    error: localize.DataScience.noInterpreter()
};

function isCommandFinderCancelled(command: JupyterCommands, token?: CancellationToken) {
    if (Cancellation.isCanceled(token)) {
        traceInfo(`Command finder cancelled for ${command}.`);
        return true;
    }
    return false;
}

type ProgressNotification = Progress<{ message?: string | undefined; increment?: number | undefined }>;

@injectable()
export class JupyterCommandFinderImpl {
    private readonly processServicePromise: Promise<IProcessService>;
    private jupyterPath?: string;
    private readonly commands = new Map<JupyterCommands, Promise<IFindCommandResult>>();
    constructor(
        @unmanaged() protected readonly interpreterService: IInterpreterService,
        @unmanaged() private readonly executionFactory: IPythonExecutionFactory,
        @unmanaged() private readonly configuration: IConfigurationService,
        @unmanaged() private readonly knownSearchPaths: IKnownSearchPathsForInterpreters,
        @unmanaged() disposableRegistry: IDisposableRegistry,
        @unmanaged() protected readonly fileSystem: IFileSystem,
        @unmanaged() private readonly processServiceFactory: IProcessServiceFactory,
        @unmanaged() private readonly commandFactory: IJupyterCommandFactory,
        @unmanaged() protected readonly workspace: IWorkspaceService,
        @unmanaged() private readonly appShell: IApplicationShell
    ) {
        this.processServicePromise = this.processServiceFactory.create();
        disposableRegistry.push(this.interpreterService.onDidChangeInterpreter(async () => this.clearCache()));
        if (workspace) {
            const disposable = workspace.onDidChangeConfiguration(async (e) => {
                if (e.affectsConfiguration('python.dataScience.searchForJupyter', undefined)) {
                    // When config changes happen, recreate our commands.
                    await this.clearCache();
                }
            });
            disposableRegistry.push(disposable);
        }
    }
    /**
     * For jupyter,
     * - Look in current interpreter, if found create something that has path and args
     *  - Look in other interpreters, if found create something that has path and args
     *  - Look on path, if found create something that has path and args
     *
     * For general case
     *  - Look for module in current interpreter, if found create something with python path and -m module
     *  - Look in other interpreters, if found create something with python path and -m module
     *  - Look on path for jupyter, if found create something with jupyter path and args
     *
     * @param {JupyterCommands} command
     * @param {CancellationToken} [cancelToken]
     * @returns {Promise<IFindCommandResult>}
     * @memberof JupyterCommandFinder
     */
    public async findBestCommand(
        command: JupyterCommands,
        cancelToken?: CancellationToken
    ): Promise<IFindCommandResult> {
        if (this.commands.has(command)) {
            return this.commands.get(command)!;
        }

        // Only log telemetry if not already found (meaning the first time)
        const timer = new StopWatch();
        const promise = this.findBestCommandImpl(command, cancelToken).finally(() =>
            sendTelemetryEvent(Telemetry.FindJupyterCommand, timer.elapsedTime, { command })
        );

        if (cancelToken) {
            let promiseCompleted = false;
            promise.finally(() => (promiseCompleted = true)).ignoreErrors();

            // If the promise is not pending, then remove the item from cache.
            // As the promise would not complete correctly, as its been cancelled.
            if (cancelToken.isCancellationRequested && !promiseCompleted) {
                this.commands.delete(command);
            }
            cancelToken.onCancellationRequested(() => {
                // If the promise is not pending, then remove the item from cache.
                // As the promise would not complete correctly, as its been cancelled.
                if (!promiseCompleted) {
                    this.commands.delete(command);
                }
            });
        }

        this.commands.set(command, promise);
        return promise;
    }

    /**
     * Clears the caching of any commands so a search starts a new
     */
    public async clearCache(): Promise<void> {
        this.commands.clear();
    }

    protected async findInterpreterCommand(
        command: JupyterCommands,
        interpreter: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<IFindCommandResult> {
        let findResult: IFindCommandResult = {
            status: ModuleExistsStatus.NotFound,
            error: localize.DataScience.noInterpreter()
        };

        // If the module is found on this interpreter, then we found it.
        if (interpreter && !Cancellation.isCanceled(cancelToken)) {
            const [result, activeInterpreter] = await Promise.all([
                this.doesModuleExist(command, interpreter, cancelToken),
                this.interpreterService.getActiveInterpreter(undefined)
            ]);
            findResult = result!;
            const isActiveInterpreter = activeInterpreter ? activeInterpreter.path === interpreter.path : false;
            if (findResult.status === ModuleExistsStatus.FoundJupyter) {
                findResult.command = this.commandFactory.createInterpreterCommand(
                    command,
                    'jupyter',
                    ['-m', 'jupyter', command],
                    interpreter,
                    isActiveInterpreter
                );
            } else if (findResult.status === ModuleExistsStatus.Found) {
                findResult.command = this.commandFactory.createInterpreterCommand(
                    command,
                    command,
                    ['-m', command],
                    interpreter,
                    isActiveInterpreter
                );
            }
        }
        return findResult;
    }

    private async lookForJupyterInDirectory(pathToCheck: string): Promise<string[]> {
        try {
            const files = await this.fileSystem.getFiles(pathToCheck);
            return files ? files.filter((s) => RegExpValues.CheckJupyterRegEx.test(path.basename(s))) : [];
        } catch (err) {
            traceWarning('Python Extension (fileSystem.getFiles):', err);
        }
        return [] as string[];
    }

    private async searchPathsForJupyter(): Promise<string | undefined> {
        if (!this.jupyterPath) {
            const paths = this.knownSearchPaths.getSearchPaths();
            for (let i = 0; i < paths.length && !this.jupyterPath; i += 1) {
                const found = await this.lookForJupyterInDirectory(paths[i]);
                if (found.length > 0) {
                    this.jupyterPath = found[0];
                }
            }
        }
        return this.jupyterPath;
    }

    private async findPathCommand(
        command: JupyterCommands,
        cancelToken?: CancellationToken
    ): Promise<IFindCommandResult> {
        if ((await this.doesJupyterCommandExist(command, cancelToken)) && !Cancellation.isCanceled(cancelToken)) {
            // Search the known paths for jupyter
            const jupyterPath = await this.searchPathsForJupyter();
            if (jupyterPath) {
                return {
                    status: ModuleExistsStatus.Found,
                    command: this.commandFactory.createProcessCommand(jupyterPath, [command])
                };
            }
        }
        return {
            status: ModuleExistsStatus.NotFound
        };
    }

    private supportsSearchingForCommands(): boolean {
        if (this.configuration) {
            const settings = this.configuration.getSettings(undefined);
            if (settings) {
                return settings.datascience.searchForJupyter;
            }
        }
        return true;
    }
    // tslint:disable:cyclomatic-complexity max-func-body-length
    private async findBestCommandImpl(
        command: JupyterCommands,
        cancelToken?: CancellationToken
    ): Promise<IFindCommandResult> {
        let found: IFindCommandResult = {
            status: ModuleExistsStatus.NotFound
        };
        let firstError: string | undefined;

        // First we look in the current interpreter
        const current = await this.interpreterService.getActiveInterpreter(undefined);
        const stopWatch = new StopWatch();

        if (isCommandFinderCancelled(command, cancelToken)) {
            return cancelledResult;
        }

        found = current ? await this.findInterpreterCommand(command, current, cancelToken) : found;
        if (found.status === ModuleExistsStatus.NotFound) {
            traceInfo(
                `Active interpreter does not support ${command} because of error ${found.error}. Interpreter is ${
                    current ? current.displayName : 'undefined'
                }.`
            );

            // Save our error information. This should propagate out as the error information for the command
            firstError = found.error;
        } else {
            this.sendSearchTelemetry(command, 'activeInterpreter', stopWatch.elapsedTime, cancelToken);
        }

        // Display a progress message when searching, as this could take a while.
        if (found.status === ModuleExistsStatus.NotFound && this.supportsSearchingForCommands()) {
            // Display a progress message and allow user to cancel searching.
            // If searching has been called from a calling code, then dismiss the progress message by resolving the search.
            const options: ProgressOptions = {
                cancellable: true,
                location: ProgressLocation.Notification,
                title: localize.DataScience.findJupyterCommandProgress().format(command)
            };
            found = await this.appShell.withProgress<IFindCommandResult>(options, async (progress, token) => {
                cancelToken = wrapCancellationTokens(cancelToken, token);

                found = await this.searchOtherInterpretersForCommand(command, progress, current, cancelToken);

                if (isCommandFinderCancelled(command, cancelToken)) {
                    return cancelledResult;
                }

                // If still not found, try looking on the path using jupyter
                if (found.status === ModuleExistsStatus.NotFound) {
                    progress.report({ message: localize.DataScience.findJupyterCommandProgressSearchCurrentPath() });
                    found = await this.findPathCommand(command, cancelToken);
                    if (found.status !== ModuleExistsStatus.NotFound) {
                        this.sendSearchTelemetry(command, 'path', stopWatch.elapsedTime, cancelToken);
                    }
                } else {
                    this.sendSearchTelemetry(command, 'otherInterpreter', stopWatch.elapsedTime, cancelToken);
                }

                return found;
            });
        }

        // Make sure found is set (tests can mess this up when interpreters aren't returned)
        if (!found) {
            found = {
                status: ModuleExistsStatus.NotFound
            };
        }

        // Set the original error so we
        // can propagate the reason to the user
        if (firstError) {
            found.error = firstError;
        }

        // Note to self, if found is undefined, check that your test is actually
        // setting up different services correctly. Some method must be undefined.
        if (found.status === ModuleExistsStatus.NotFound) {
            this.sendSearchTelemetry(command, 'nowhere', stopWatch.elapsedTime, cancelToken);
        }

        return found;
    }
    private sendSearchTelemetry(
        command: JupyterCommands,
        where: 'activeInterpreter' | 'otherInterpreter' | 'path' | 'nowhere',
        elapsedTime: number,
        cancelToken?: CancellationToken
    ) {
        if (Cancellation.isCanceled(cancelToken)) {
            return;
        }
        sendTelemetryEvent(Telemetry.JupyterCommandSearch, elapsedTime, { where, command });
    }
    private async searchOtherInterpretersForCommand(
        command: JupyterCommands,
        progress: ProgressNotification,
        current?: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<IFindCommandResult> {
        let found: IFindCommandResult = {
            status: ModuleExistsStatus.NotFound
        };

        // Look through all of our interpreters (minus the active one at the same time)
        const cancelGetInterpreters = createPromiseFromCancellation<PythonInterpreter[]>({
            defaultValue: [],
            cancelAction: 'resolve',
            token: cancelToken
        });
        const all = await Promise.race([this.interpreterService.getInterpreters(undefined), cancelGetInterpreters]);

        if (isCommandFinderCancelled(command, cancelToken)) {
            return cancelledResult;
        }

        if (!all || all.length === 0) {
            traceWarning('No interpreters found. Jupyter cannot run.');
        }

        const cancelFind = createPromiseFromCancellation<IFindCommandResult[]>({
            defaultValue: [],
            cancelAction: 'resolve',
            token: cancelToken
        });
        const promises = all
            .filter((i) => i !== current)
            .map((i) => this.findInterpreterCommand(command, i, cancelToken));
        const foundList = await Promise.race([Promise.all(promises), cancelFind]);

        if (isCommandFinderCancelled(command, cancelToken)) {
            return cancelledResult;
        }

        // Then go through all of the found ones and pick the closest python match
        if (current && current.version) {
            let bestScore = -1;
            for (const entry of foundList) {
                let currentScore = 0;
                if (!entry || !entry.command) {
                    continue;
                }
                const interpreter = await entry.command.interpreter();
                if (isCommandFinderCancelled(command, cancelToken)) {
                    return cancelledResult;
                }
                // Keep the progress message ticking with list of interpreters that are searched.
                if (interpreter && interpreter.displayName) {
                    progress.report({
                        message: localize.DataScience.findJupyterCommandProgressCheckInterpreter().format(
                            interpreter.displayName
                        )
                    });
                }
                const version = interpreter ? interpreter.version : undefined;
                if (version) {
                    if (version.major === current.version.major) {
                        currentScore += 4;
                        if (version.minor === current.version.minor) {
                            currentScore += 2;
                            if (version.patch === current.version.patch) {
                                currentScore += 1;
                            }
                        }
                    }
                }
                if (currentScore > bestScore) {
                    found = entry;
                    bestScore = currentScore;
                }
            }
        } else {
            // Just pick the first one
            found = foundList.find((f) => f.status !== ModuleExistsStatus.NotFound) || found;
        }

        return found;
    }
    private async createExecutionService(interpreter: PythonInterpreter): Promise<IPythonExecutionService> {
        const [currentInterpreter, pythonService] = await Promise.all([
            this.interpreterService.getActiveInterpreter(undefined),
            this.executionFactory.createActivatedEnvironment({
                resource: undefined,
                interpreter,
                allowEnvironmentFetchExceptions: true,
                bypassCondaExecution: true
            })
        ]);

        // Use daemons for current interpreter, when using any other interpreter, do not use a daemon.
        // Creating daemons for other interpreters might not be what we want.
        // E.g. users can have dozens of pipenv or conda environments.
        // In such cases, we'd end up creating n*3 python processes that are long lived.
        if (!currentInterpreter || currentInterpreter.path !== interpreter.path) {
            return pythonService!;
        }

        return this.executionFactory.createDaemon({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path });
    }
    private async doesModuleExist(
        moduleName: string,
        interpreter: PythonInterpreter,
        cancelToken?: CancellationToken
    ): Promise<IModuleExistsResult> {
        const result: IModuleExistsResult = {
            status: ModuleExistsStatus.NotFound
        };
        if (interpreter && interpreter !== null) {
            const newOptions: SpawnOptions = { throwOnStdErr: false, encoding: 'utf8', token: cancelToken };
            const pythonService = await this.createExecutionService(interpreter);

            try {
                const execResult = await pythonService.execModule('jupyter', [moduleName, '--version'], newOptions);
                if (execResult.stderr) {
                    traceWarning(`${execResult.stderr} for ${interpreter.path}`);
                    result.error = execResult.stderr;
                } else {
                    result.status = ModuleExistsStatus.FoundJupyter;
                }
            } catch (err) {
                traceWarning(`${err} for ${interpreter.path}`);
            }

            // After trying first as "-m jupyter <module> --version" then try "-m <module> --version" as this works in some cases
            // for example if not running in an activated environment without script on the path
            if (result.status === ModuleExistsStatus.NotFound) {
                try {
                    const execResult = await pythonService.execModule(moduleName, ['--version'], newOptions);
                    if (execResult.stderr) {
                        traceWarning(`${execResult.stderr} for ${interpreter.path}`);
                        result.error = execResult.stderr;
                    } else {
                        result.status = ModuleExistsStatus.Found;
                    }
                } catch (err) {
                    traceWarning(`${err} for ${interpreter.path}`);
                    result.status = ModuleExistsStatus.NotFound;
                    result.error = err.toString();
                }
            }
        } else {
            traceWarning(`Interpreter not found. ${moduleName} cannot be loaded.`);
            result.status = ModuleExistsStatus.NotFound;
        }

        return result;
    }

    private async doesJupyterCommandExist(command: JupyterCommands, cancelToken?: CancellationToken): Promise<boolean> {
        const newOptions: SpawnOptions = { throwOnStdErr: true, encoding: 'utf8', token: cancelToken };
        const args = [command, '--version'];
        const processService = await this.processServicePromise;
        try {
            const result = await processService.exec('jupyter', args, newOptions);
            return !result.stderr;
        } catch (err) {
            traceWarning(err);
            return false;
        }
    }
}

type CacheInfo = {
    /**
     * Cache store (across VSC sessions).
     *
     * @type {IPersistentState<string | undefined>}
     */
    state: IPersistentState<string | undefined>;
    /**
     * State information in current VS Code session.
     * Faster than checking VSC Session.
     * Updating VSC cache takes a while, in the interim this property will contain the information.
     *
     * @type {IFindCommandResult}
     */
    sessionState?: IFindCommandResult;
    /**
     * Whether we have checked the cache store.
     * If checked, then use the value in `sessionState`.
     * Its possible that value is empty, meaning nothing could be found.
     *
     * @type {boolean}
     */
    checked?: boolean;
};

/**
 * Decorates the `JupyterCommanFinderImpl` with ability to cache the results.
 *
 * @export
 * @class CachedCommandFinder
 * @extends {JupyterCommandFinderImpl}
 */
@injectable()
export class JupyterCommandFinder extends JupyterCommandFinderImpl {
    private readonly workspaceJupyterInterpreter: CacheInfo;
    private readonly globalJupyterInterpreter: CacheInfo;
    private findNotebookCommandPromise?: Deferred<IFindCommandResult>;
    constructor(
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IPythonExecutionFactory) executionFactory: IPythonExecutionFactory,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(IKnownSearchPathsForInterpreters) knownSearchPaths: IKnownSearchPathsForInterpreters,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IProcessServiceFactory) processServiceFactory: IProcessServiceFactory,
        @inject(IJupyterCommandFactory) commandFactory: IJupyterCommandFactory,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IPersistentStateFactory) persistentStateFactory: IPersistentStateFactory
    ) {
        super(
            interpreterService,
            executionFactory,
            configuration,
            knownSearchPaths,
            disposableRegistry,
            fileSystem,
            processServiceFactory,
            commandFactory,
            workspace,
            appShell
        );

        // Cache stores to keep track of jupyter interpreters found.
        const workspaceState = persistentStateFactory.createWorkspacePersistentState<string>(
            'DS-VSC-JupyterInterpreter'
        );
        const globalState = persistentStateFactory.createGlobalPersistentState<string>('DS-VSC-JupyterInterpreter');
        this.workspaceJupyterInterpreter = { state: workspaceState };
        this.globalJupyterInterpreter = { state: globalState };
    }
    private get cacheStore(): CacheInfo {
        return this.workspace.hasWorkspaceFolders ? this.workspaceJupyterInterpreter : this.globalJupyterInterpreter;
    }
    public findBestCommand(command: JupyterCommands, token?: CancellationToken): Promise<IFindCommandResult> {
        if (
            command === JupyterCommands.NotebookCommand &&
            this.findNotebookCommandPromise &&
            !this.findNotebookCommandPromise.rejected
        ) {
            // Use previously seached item, also possible the promise has not yet resolved.
            // I.e. use same search.
            return this.findNotebookCommandPromise.promise;
        } else if (command === JupyterCommands.NotebookCommand) {
            // Otherwise wrap the result so we can check for a failure.
            this.findNotebookCommandPromise = createDeferred<IFindCommandResult>();
            return this.findBestNotebookCommand(token)
                .then((r) => {
                    this.findNotebookCommandPromise?.resolve(r);
                    return r;
                })
                .catch((e) => {
                    this.findNotebookCommandPromise?.reject(e);
                    throw e;
                });
        } else {
            return super.findBestCommand(command, token);
        }
    }
    public async clearCache(): Promise<void> {
        this.cacheStore.checked = undefined;
        this.cacheStore.sessionState = undefined;
        this.findNotebookCommandPromise = undefined;
        await this.cacheStore.state.updateValue(undefined);
        await super.clearCache();
    }
    private async findBestNotebookCommand(token?: CancellationToken): Promise<IFindCommandResult> {
        const command = JupyterCommands.NotebookCommand;
        // Searching takes a while.
        // Lets search our cache for the command.
        // But lets also search. Its possible searching is faster than getting from cache (unlikely)
        // However, its more likely for cache to return nothing. Which would mean we'd need to search.
        // Lets try to do both together. If we get a successful hit from the cache, then we can cancel the search & vice-versa.

        const cancellationTokenSource = new CancellationTokenSource();
        const wrappedToken = wrapCancellationTokens(token, cancellationTokenSource.token);
        const searchPromise = super.findBestCommand(command, wrappedToken).then((cmd) => ({ cmd, source: 'search' }));
        const cachePromise = this.getCachedNotebookInterpreter(wrappedToken).then((cmd) => ({ cmd, source: 'cache' }));

        // Take which ever comes first.
        // Searching cache will certainly be faster, use that.
        const result = await Promise.race([searchPromise, cachePromise]);
        if (result.source === 'cache' && result.cmd) {
            // No need to search any more, cancel it as the cache came back earlier.
            cancellationTokenSource.cancel();
            return result.cmd;
        }

        // Ok, now its possible cache came back empty, in which case we need to search.
        // Or its possible find came back first, in which case we need to resolve the search promise.
        // I.e. we need to wait for search to complete.
        const searchResult = await searchPromise;
        // No need to search cache any more, cancel it.
        // And update the cache store with what ever we got from the find.
        cancellationTokenSource.cancel();
        this.updateCacheWithInterpreter(searchResult.cmd);
        return searchResult.cmd;
    }
    private updateCacheWithInterpreter(result?: IFindCommandResult, cancelToken?: CancellationToken) {
        if (!result || result.status === ModuleExistsStatus.NotFound) {
            // Ensure we remove this so others don't try using this.
            // Possible we don't have any interpeter, or the one
            // that was available has been uninstalled.
            this.cacheStore.state.updateValue(undefined).ignoreErrors();
            return;
        }

        if (!result.command) {
            throw new Error('Jupyter Command is undefined');
        }

        // Cache for current session.
        this.cacheStore.sessionState = result;
        this.cacheStore.checked = true;

        // Cache for other VS Code sessions.
        // i.e. make it available when new VS Code instance is opened.
        new Promise(async (resolve) => {
            try {
                const interpreter = await result.command!.interpreter();
                if (!interpreter || (cancelToken && cancelToken.isCancellationRequested)) {
                    return;
                }
                await this.cacheStore.state.updateValue(interpreter ? interpreter.path : undefined);
            } catch (ex) {
                traceError('Failed to update Jupyter Command', ex);
            } finally {
                resolve();
            }
        }).ignoreErrors();
    }
    private async getCachedNotebookInterpreter(
        cancelToken: CancellationToken
    ): Promise<IFindCommandResult | undefined> {
        // We have already checked in current session.
        if (this.cacheStore.checked) {
            return this.cacheStore.sessionState;
        }
        // Nohting cached from another VSC session.
        if (!this.cacheStore.state.value) {
            return;
        }
        const result = await this.getNotebookCommand(this.cacheStore.state.value, cancelToken);
        if (!result || !result.command) {
            this.cacheStore.checked = true;
            return;
        }

        this.updateCacheWithInterpreter(result, cancelToken);
    }

    private async getNotebookCommand(
        pythonPath: string,
        cancelToken: CancellationToken
    ): Promise<IFindCommandResult | undefined> {
        if (cancelToken.isCancellationRequested || !(await this.fileSystem.fileExists(pythonPath))) {
            return;
        }
        const interpreterInfo = await this.interpreterService.getInterpreterDetails(pythonPath);
        if (!interpreterInfo || cancelToken.isCancellationRequested) {
            return;
        }
        const result = await this.findInterpreterCommand(JupyterCommands.NotebookCommand, interpreterInfo, cancelToken);
        return result.status === ModuleExistsStatus.NotFound ? undefined : result;
    }
}
