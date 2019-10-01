// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { CancellationToken } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { Cancellation, createPromiseFromCancellation } from '../../common/cancellation';
import { traceInfo, traceWarning } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { IProcessService, IProcessServiceFactory, IPythonExecutionFactory, SpawnOptions } from '../../common/process/types';
import { IConfigurationService, IDisposableRegistry, ILogger } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { IInterpreterService, IKnownSearchPathsForInterpreters, PythonInterpreter } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { JupyterCommands, RegExpValues, Telemetry } from '../constants';
import { IJupyterCommand, IJupyterCommandFactory } from '../types';

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
export class JupyterCommandFinder {
    private readonly processServicePromise: Promise<IProcessService>;
    private jupyterPath?: string;
    private readonly commands = new Map<JupyterCommands, IFindCommandResult>();
    constructor(
        private readonly interpreterService: IInterpreterService,
        private readonly executionFactory: IPythonExecutionFactory,
        private readonly configuration: IConfigurationService,
        private readonly knownSearchPaths: IKnownSearchPathsForInterpreters,
        disposableRegistry: IDisposableRegistry,
        private readonly fileSystem: IFileSystem,
        private readonly logger: ILogger,
        private readonly processServiceFactory: IProcessServiceFactory,
        private readonly commandFactory: IJupyterCommandFactory,
        workspace: IWorkspaceService
    ) {
        this.processServicePromise = this.processServiceFactory.create();
        disposableRegistry.push(this.interpreterService.onDidChangeInterpreter(() => this.commands.clear()));
        if (workspace) {
            const disposable = workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python.dataScience', undefined)) {
                    // When config changes happen, recreate our commands.
                    this.commands.clear();
                }
            });
            disposableRegistry.push(disposable);
        }
    }

    public async findBestCommand(command: JupyterCommands, cancelToken?: CancellationToken): Promise<IFindCommandResult> {
        // Only log telemetry if not already found (meaning the first time)
        let timer: StopWatch | undefined;
        if (!this.commands.has(command)) {
            timer = new StopWatch();
        }
        try {
            return await this.findBestCommandImpl(command, cancelToken);
        } finally {
            if (timer) {
                sendTelemetryEvent(Telemetry.FindJupyterCommand, timer.elapsedTime, { command });
            }
        }
    }
    private async findInterpreterCommand(command: JupyterCommands, interpreter: PythonInterpreter, cancelToken?: CancellationToken): Promise<IFindCommandResult> {
        let findResult: IFindCommandResult = {
            status: ModuleExistsStatus.NotFound,
            error: localize.DataScience.noInterpreter()
        };

        // If the module is found on this interpreter, then we found it.
        if (interpreter && !Cancellation.isCanceled(cancelToken)) {
            findResult = await this.doesModuleExist(command, interpreter, cancelToken);
            if (findResult.status === ModuleExistsStatus.FoundJupyter) {
                findResult.command = this.commandFactory.createInterpreterCommand(['-m', 'jupyter', command], interpreter);
            } else if (findResult.status === ModuleExistsStatus.Found) {
                findResult.command = this.commandFactory.createInterpreterCommand(['-m', command], interpreter);
            }
        }

        return findResult;
    }

    private async lookForJupyterInDirectory(pathToCheck: string): Promise<string[]> {
        try {
            const files = await this.fileSystem.getFiles(pathToCheck);
            return files ? files.filter(s => RegExpValues.CheckJupyterRegEx.test(path.basename(s))) : [];
        } catch (err) {
            this.logger.logWarning('Python Extension (fileSystem.getFiles):', err);
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

    private async findPathCommand(command: JupyterCommands, cancelToken?: CancellationToken): Promise<IFindCommandResult> {
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
            const settings = this.configuration.getSettings();
            if (settings) {
                return settings.datascience.searchForJupyter;
            }
        }
        return true;
    }

    // For jupyter,
    // - Look in current interpreter, if found create something that has path and args
    // - Look in other interpreters, if found create something that has path and args
    // - Look on path, if found create something that has path and args
    // For general case
    // - Look for module in current interpreter, if found create something with python path and -m module
    // - Look in other interpreters, if found create something with python path and -m module
    // - Look on path for jupyter, if found create something with jupyter path and args
    // tslint:disable:cyclomatic-complexity max-func-body-length
    private async findBestCommandImpl(command: JupyterCommands, cancelToken?: CancellationToken): Promise<IFindCommandResult> {
        let found: IFindCommandResult = {
            status: ModuleExistsStatus.NotFound
        };
        let firstError: string | undefined;

        // See if we already have this command in list
        if (!this.commands.has(command)) {
            // Not found, try to find it.

            // First we look in the current interpreter
            const current = await this.interpreterService.getActiveInterpreter();

            if (isCommandFinderCancelled(command, cancelToken)) {
                return cancelledResult;
            }

            found = current ? await this.findInterpreterCommand(command, current, cancelToken) : found;
            if (found.status === ModuleExistsStatus.NotFound) {
                traceInfo(`Active interpreter does not support ${command} because of error ${found.error}. Interpreter is ${current ? current.displayName : 'undefined'}.`);

                // Save our error information. This should propagate out as the error information for the command
                firstError = found.error;
            }
            if (found.status === ModuleExistsStatus.NotFound && this.supportsSearchingForCommands()) {
                // Look through all of our interpreters (minus the active one at the same time)
                const cancelGetInterpreters = createPromiseFromCancellation<PythonInterpreter[]>({ defaultValue: [], cancelAction: 'resolve', token: cancelToken });
                const all = await Promise.race([this.interpreterService.getInterpreters(), cancelGetInterpreters]);

                if (isCommandFinderCancelled(command, cancelToken)) {
                    return cancelledResult;
                }

                if (!all || all.length === 0) {
                    traceWarning('No interpreters found. Jupyter cannot run.');
                }

                const cancelFind = createPromiseFromCancellation<IFindCommandResult[]>({ defaultValue: [], cancelAction: 'resolve', token: cancelToken });
                const promises = all.filter(i => i !== current).map(i => this.findInterpreterCommand(command, i, cancelToken));
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
                    found = foundList.find(f => f.status !== ModuleExistsStatus.NotFound) || found;
                }
            }

            // If still not found, try looking on the path using jupyter
            if (found.status === ModuleExistsStatus.NotFound && this.supportsSearchingForCommands()) {
                found = await this.findPathCommand(command, cancelToken);
            }

            // Set the original error so we
            // can propagate the reason to the user
            if (firstError) {
                found.error = firstError;
            }

            // If we found a command, save in our dictionary
            if (found) {
                this.commands.set(command, found);
            }
        }

        // Return results
        return this.commands.get(command) || found;
    }

    private async doesModuleExist(moduleName: string, interpreter: PythonInterpreter, cancelToken?: CancellationToken): Promise<IModuleExistsResult> {
        const result: IModuleExistsResult = {
            status: ModuleExistsStatus.NotFound
        };
        if (interpreter && interpreter !== null) {
            const newOptions: SpawnOptions = { throwOnStdErr: false, encoding: 'utf8', token: cancelToken };
            const pythonService = await this.executionFactory.createActivatedEnvironment({ resource: undefined, interpreter, allowEnvironmentFetchExceptions: true });

            // For commands not 'ipykernel' first try them as jupyter commands
            if (moduleName !== JupyterCommands.KernelCreateCommand) {
                try {
                    const execResult = await pythonService.execModule('jupyter', [moduleName, '--version'], newOptions);
                    if (execResult.stderr) {
                        this.logger.logWarning(`${execResult.stderr} for ${interpreter.path}`);
                        result.error = execResult.stderr;
                    } else {
                        result.status = ModuleExistsStatus.FoundJupyter;
                    }
                } catch (err) {
                    this.logger.logWarning(`${err} for ${interpreter.path}`);
                }
            }

            // After trying first as "-m jupyter <module> --version" then try "-m <module> --version" as this works in some cases
            // for example if not running in an activated environment without script on the path
            if (result.status === ModuleExistsStatus.NotFound) {
                try {
                    const execResult = await pythonService.execModule(moduleName, ['--version'], newOptions);
                    if (execResult.stderr) {
                        this.logger.logWarning(`${execResult.stderr} for ${interpreter.path}`);
                        result.error = execResult.stderr;
                    } else {
                        result.status = ModuleExistsStatus.Found;
                    }
                } catch (err) {
                    this.logger.logWarning(`${err} for ${interpreter.path}`);
                    result.status = ModuleExistsStatus.NotFound;
                    result.error = err.toString();
                }
            }
        } else {
            this.logger.logWarning(`Interpreter not found. ${moduleName} cannot be loaded.`);
            result.status = ModuleExistsStatus.NotFound;
        }

        return result;
    }

    private async doesJupyterCommandExist(command?: JupyterCommands, cancelToken?: CancellationToken): Promise<boolean> {
        const newOptions: SpawnOptions = { throwOnStdErr: true, encoding: 'utf8', token: cancelToken };
        const args = command ? [command, '--version'] : ['--version'];
        const processService = await this.processServicePromise;
        try {
            const result = await processService.exec('jupyter', args, newOptions);
            return !result.stderr;
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }
}
