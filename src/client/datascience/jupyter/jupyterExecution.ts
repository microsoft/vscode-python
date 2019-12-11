// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as uuid from 'uuid/v4';
import { CancellationToken, Event, EventEmitter } from 'vscode';

import { ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { Cancellation } from '../../common/cancellation';
import { traceInfo } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry, ILogger } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { JupyterCommands, Telemetry } from '../constants';
import {
    IConnection,
    IJupyterExecution,
    INotebookServer,
    INotebookServerLaunchInfo,
    INotebookServerOptions
} from '../types';
import { IFindCommandResult, JupyterCommandFinder } from './jupyterCommandFinder';
import { JupyterInstallError } from './jupyterInstallError';
import { JupyterSelfCertsError } from './jupyterSelfCertsError';
import { createRemoteConnectionInfo } from './jupyterUtils';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';
import { KernelSelector, KernelSpecInterpreter } from './kernels/kernelSelector';
import { NotebookStarter } from './notebookStarter';

export class JupyterExecutionBase implements IJupyterExecution {

    private usablePythonInterpreter: PythonInterpreter | undefined;
    private eventEmitter: EventEmitter<void> = new EventEmitter<void>();
    private disposed: boolean = false;
    private readonly commandFinder: JupyterCommandFinder;

    constructor(
        _liveShare: ILiveShareApi,
        private readonly interpreterService: IInterpreterService,
        private readonly logger: ILogger,
        private readonly disposableRegistry: IDisposableRegistry,
        workspace: IWorkspaceService,
        private readonly configuration: IConfigurationService,
        private readonly kernelSelector: KernelSelector,
        private readonly notebookStarter: NotebookStarter,
        private readonly serviceContainer: IServiceContainer
    ) {
        this.commandFinder = serviceContainer.get<JupyterCommandFinder>(JupyterCommandFinder);
        this.disposableRegistry.push(this.interpreterService.onDidChangeInterpreter(() => this.onSettingsChanged()));
        this.disposableRegistry.push(this);

        if (workspace) {
            const disposable = workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('python.dataScience', undefined)) {
                    // When config changes happen, recreate our commands.
                    this.onSettingsChanged();
                }
            });
            this.disposableRegistry.push(disposable);
        }
    }

    public get sessionChanged(): Event<void> {
        return this.eventEmitter.event;
    }

    public dispose(): Promise<void> {
        this.disposed = true;
        return Promise.resolve();
    }

    public async refreshCommands(): Promise<void> {
        await this.commandFinder.clearCache();
    }

    public isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command notebook
        return Cancellation.race(() => this.isCommandSupported(JupyterCommands.NotebookCommand, cancelToken), cancelToken);
    }

    public async getNotebookError(): Promise<string> {
        const notebook = await this.findBestCommand(JupyterCommands.NotebookCommand);
        return notebook.error ? notebook.error : localize.DataScience.notebookNotFound();
    }

    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> {
        // Only try to compute this once.
        if (!this.usablePythonInterpreter && !this.disposed) {
            this.usablePythonInterpreter = await Cancellation.race(() => this.getUsableJupyterPythonImpl(cancelToken), cancelToken);
        }
        return this.usablePythonInterpreter;
    }

    public isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command nbconvert
        return Cancellation.race(() => this.isCommandSupported(JupyterCommands.ConvertCommand), cancelToken);
    }

    public isSpawnSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // Supported if we can run a notebook
        return this.isNotebookSupported(cancelToken);
    }

    //tslint:disable:cyclomatic-complexity
    public connectToNotebookServer(options?: INotebookServerOptions, cancelToken?: CancellationToken): Promise<INotebookServer | undefined> {
        // Return nothing if we cancel
        return Cancellation.race(async () => {
            let result: INotebookServer | undefined;
            let connection: IConnection | undefined;
            let kernelSpecInterpreter: KernelSpecInterpreter | undefined;
            let kernelSpecInterpreterPromise: Promise<KernelSpecInterpreter> = Promise.resolve({});
            traceInfo(`Connecting to ${options ? options.purpose : 'unknown type of'} server`);

            if (!options || !options.uri) {
                // Get hold of the kernelspec and corresponding (matching) interpreter that'll be used as the spec.
                // We can do this in parallel, while starting the server (faster).
                traceInfo(`Getting kernel specs for ${options ? options.purpose : 'unknown type of'} server`);
                kernelSpecInterpreterPromise = this.kernelSelector.getKernelForLocalConnection(undefined, options?.metadata, cancelToken);
            }

            // Try to connect to our jupyter process. Check our setting for the number of tries
            let tryCount = 0;
            const maxTries = this.configuration.getSettings().datascience.jupyterLaunchRetries;
            while (tryCount < maxTries) {
                try {
                    // Start or connect to the process
                    [connection, kernelSpecInterpreter] = await Promise.all([this.startOrConnect(options, cancelToken), kernelSpecInterpreterPromise]);
                    // Create a server that we will then attempt to connect to.
                    result = this.serviceContainer.get<INotebookServer>(INotebookServer);

                    // Populate the launch info that we are starting our server with
                    const launchInfo: INotebookServerLaunchInfo = {
                        connectionInfo: connection!,
                        interpreter: kernelSpecInterpreter.interpreter,
                        kernelSpec: kernelSpecInterpreter.kernelSpec,
                        workingDir: options ? options.workingDir : undefined,
                        uri: options ? options.uri : undefined,
                        purpose: options ? options.purpose : uuid(),
                        enableDebugging: options ? options.enableDebugging : false
                    };

                    traceInfo(`Connecting to process for ${options ? options.purpose : 'unknown type of'} server`);
                    await result.connect(launchInfo, cancelToken);
                    traceInfo(`Connection complete for ${options ? options.purpose : 'unknown type of'} server`);

                    sendTelemetryEvent(launchInfo.uri ? Telemetry.ConnectRemoteJupyter : Telemetry.ConnectLocalJupyter);
                    return result;
                } catch (err) {
                    // Cleanup after ourselves. server may be running partially.
                    if (result) {
                        traceInfo('Killing server because of error');
                        await result.dispose();
                    }
                    if (err instanceof JupyterWaitForIdleError && tryCount < maxTries) {
                        // Special case. This sometimes happens where jupyter doesn't ever connect. Cleanup after
                        // ourselves and propagate the failure outwards.
                        traceInfo('Retry because of wait for idle problem.');
                        sendTelemetryEvent(Telemetry.SessionIdleTimeout);
                        tryCount += 1;
                    } else if (connection) {
                        // Something else went wrong
                        if (options && options.uri) {
                            sendTelemetryEvent(Telemetry.ConnectRemoteFailedJupyter);

                            // Check for the self signed certs error specifically
                            if (err.message.indexOf('reason: self signed certificate') >= 0) {
                                sendTelemetryEvent(Telemetry.ConnectRemoteSelfCertFailedJupyter);
                                throw new JupyterSelfCertsError(connection.baseUrl);
                            } else {
                                throw new Error(localize.DataScience.jupyterNotebookRemoteConnectFailed().format(connection.baseUrl, err));
                            }
                        } else {
                            sendTelemetryEvent(Telemetry.ConnectFailedJupyter);
                            throw new Error(localize.DataScience.jupyterNotebookConnectFailed().format(connection.baseUrl, err));
                        }
                    } else {
                        throw err;
                    }
                }
            }
        }, cancelToken);
    }

    public async spawnNotebook(file: string): Promise<void> {
        // First we find a way to start a notebook server
        const notebookCommand = await this.findBestCommand(JupyterCommands.NotebookCommand);
        this.checkNotebookCommand(notebookCommand);

        const args: string[] = [`--NotebookApp.file_to_run=${file}`];

        // Don't wait for the exec to finish and don't dispose. It's up to the user to kill the process
        notebookCommand.command!.exec(args, { throwOnStdErr: false, encoding: 'utf8' }).ignoreErrors();
    }

    public async importNotebook(file: string, template: string | undefined): Promise<string> {
        // First we find a way to start a nbconvert
        const convert = await this.findBestCommand(JupyterCommands.ConvertCommand);
        if (!convert.command) {
            throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
        }

        // Wait for the nbconvert to finish
        const args = template ? [file, '--to', 'python', '--stdout', '--template', template] : [file, '--to', 'python', '--stdout'];
        const result = await convert.command.exec(args, { throwOnStdErr: false, encoding: 'utf8' });
        if (result.stderr) {
            // Stderr on nbconvert doesn't indicate failure. Just log the result
            this.logger.logInformation(result.stderr);
        }
        return result.stdout;
    }

    public getServer(_options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        // This is cached at the host or guest level
        return Promise.resolve(undefined);
    }

    protected async findBestCommand(command: JupyterCommands, cancelToken?: CancellationToken): Promise<IFindCommandResult> {
        return this.commandFinder.findBestCommand(command, cancelToken);
    }

    private checkNotebookCommand(notebook: IFindCommandResult) {
        if (!notebook.command) {
            const errorMessage = notebook.error ? notebook.error : localize.DataScience.notebookNotFound();
            throw new JupyterInstallError(localize.DataScience.jupyterNotSupported().format(errorMessage), localize.DataScience.pythonInteractiveHelpLink());
        }
    }

    private async startOrConnect(options?: INotebookServerOptions, cancelToken?: CancellationToken): Promise<IConnection> {
        // If our uri is undefined or if it's set to local launch we need to launch a server locally
        if (!options || !options.uri) {
            traceInfo(`Launching ${options ? options.purpose : 'unknown type of'} server`);
            const useDefaultConfig = options && options.useDefaultConfig ? true : false;
            const connection = await this.startNotebookServer(useDefaultConfig, cancelToken);
            if (connection) {
                return connection;
            } else {
                // Throw a cancellation error if we were canceled.
                Cancellation.throwIfCanceled(cancelToken);

                // Otherwise we can't connect
                throw new Error(localize.DataScience.jupyterNotebookFailure().format(''));
            }
        } else {
            // If we have a URI spec up a connection info for it
            return createRemoteConnectionInfo(options.uri, this.configuration.getSettings().datascience);
        }
    }

    // tslint:disable-next-line: max-func-body-length
    @captureTelemetry(Telemetry.StartJupyter)
    private async startNotebookServer(useDefaultConfig: boolean, cancelToken?: CancellationToken): Promise<IConnection> {
        // First we find a way to start a notebook server
        const notebookCommand = await this.findBestCommand(JupyterCommands.NotebookCommand, cancelToken);
        this.checkNotebookCommand(notebookCommand);
        return this.notebookStarter.start(useDefaultConfig, cancelToken);
    }

    private getUsableJupyterPythonImpl = async (cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> => {
        // This should be the best interpreter for notebooks
        const found = await this.findBestCommand(JupyterCommands.NotebookCommand, cancelToken);
        if (found && found.command) {
            return found.command.interpreter();
        }

        return undefined;
    }

    private onSettingsChanged() {
        // Clear our usableJupyterInterpreter so that we recompute our values
        this.usablePythonInterpreter = undefined;
    }

    private isCommandSupported = async (command: JupyterCommands, cancelToken?: CancellationToken): Promise<boolean> => {
        // See if we can find the command
        try {
            const result = await this.findBestCommand(command, cancelToken);

            // Note to self, if result is undefined, check that your test is actually
            // setting up different services correctly. Some method must be undefined.
            return result.command !== undefined;
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }
}
