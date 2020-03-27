// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as portfinder from 'portfinder';
import * as uuid from 'uuid/v4';
import { CancellationToken, CancellationTokenSource, Event, EventEmitter } from 'vscode';

import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { Cancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry, IOutputChannel } from '../../common/types';
import { sleep } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import {
    IConnection,
    IJupyterExecution,
    IJupyterSessionManagerFactory,
    IJupyterSubCommandExecutionService,
    INotebookServer,
    INotebookServerLaunchInfo,
    INotebookServerOptions
} from '../types';
import { JupyterSelfCertsError } from './jupyterSelfCertsError';
import { JupyterSessionStartError } from './jupyterSession';
import { createRemoteConnectionInfo } from './jupyterUtils';
import { JupyterWaitForIdleError } from './jupyterWaitForIdleError';
import { JupyterZMQBinariesNotFoundError } from './jupyterZMQBinariesNotFoundError';
import { KernelSelector, KernelSpecInterpreter } from './kernels/kernelSelector';
import { NotebookStarter } from './notebookStarter';

const LocalHosts = ['localhost', '127.0.0.1', '::1'];

export class JupyterExecutionBase implements IJupyterExecution {
    private usablePythonInterpreter: PythonInterpreter | undefined;
    private eventEmitter: EventEmitter<void> = new EventEmitter<void>();
    private startedEmitter: EventEmitter<INotebookServerOptions> = new EventEmitter<INotebookServerOptions>();
    private disposed: boolean = false;
    private readonly jupyterInterpreterService: IJupyterSubCommandExecutionService;
    private zmqError: Error | undefined;

    constructor(
        _liveShare: ILiveShareApi,
        private readonly interpreterService: IInterpreterService,
        private readonly disposableRegistry: IDisposableRegistry,
        workspace: IWorkspaceService,
        private readonly configuration: IConfigurationService,
        private readonly kernelSelector: KernelSelector,
        private readonly notebookStarter: NotebookStarter,
        private readonly appShell: IApplicationShell,
        private readonly jupyterOutputChannel: IOutputChannel,
        private readonly serviceContainer: IServiceContainer
    ) {
        this.jupyterInterpreterService = serviceContainer.get<IJupyterSubCommandExecutionService>(
            IJupyterSubCommandExecutionService
        );
        this.disposableRegistry.push(this.interpreterService.onDidChangeInterpreter(() => this.onSettingsChanged()));
        this.disposableRegistry.push(this);

        if (workspace) {
            const disposable = workspace.onDidChangeConfiguration((e) => {
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

    public get serverStarted(): Event<INotebookServerOptions> {
        return this.startedEmitter.event;
    }

    public dispose(): Promise<void> {
        this.disposed = true;
        return Promise.resolve();
    }

    public async refreshCommands(): Promise<void> {
        await this.jupyterInterpreterService.refreshCommands();
    }

    public isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command notebook
        return this.jupyterInterpreterService.isNotebookSupported(cancelToken);
    }

    public async getNotebookError(): Promise<string> {
        return this.jupyterInterpreterService.getReasonForJupyterNotebookNotBeingSupported();
    }

    public async getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined> {
        // Only try to compute this once.
        if (!this.usablePythonInterpreter && !this.disposed) {
            this.usablePythonInterpreter = await Cancellation.race(
                () => this.jupyterInterpreterService.getSelectedInterpreter(cancelToken),
                cancelToken
            );
        }
        return this.usablePythonInterpreter;
    }

    public isImportSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // See if we can find the command nbconvert
        return this.jupyterInterpreterService.isExportSupported(cancelToken);
    }

    public isSpawnSupported(cancelToken?: CancellationToken): Promise<boolean> {
        // Supported if we can run a notebook
        return this.isNotebookSupported(cancelToken);
    }

    //tslint:disable:cyclomatic-complexity max-func-body-length
    public connectToNotebookServer(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        // Return nothing if we cancel
        // tslint:disable-next-line: max-func-body-length
        return Cancellation.race(async () => {
            let result: INotebookServer | undefined;
            let connection: IConnection | undefined;
            let kernelSpecInterpreter: KernelSpecInterpreter | undefined;
            let kernelSpecInterpreterPromise: Promise<KernelSpecInterpreter> = Promise.resolve({});
            traceInfo(`Connecting to ${options ? options.purpose : 'unknown type of'} server`);
            const allowUI = !options || options.allowUI();
            const kernelSpecCancelSource = new CancellationTokenSource();
            if (cancelToken) {
                cancelToken.onCancellationRequested(() => {
                    kernelSpecCancelSource.cancel();
                });
            }
            const isLocalConnection = !options || !options.uri;

            if (isLocalConnection) {
                // Get hold of the kernelspec and corresponding (matching) interpreter that'll be used as the spec.
                // We can do this in parallel, while starting the server (faster).
                traceInfo(`Getting kernel specs for ${options ? options.purpose : 'unknown type of'} server`);
                kernelSpecInterpreterPromise = this.kernelSelector.getKernelForLocalConnection(
                    undefined,
                    undefined,
                    options?.metadata,
                    !allowUI,
                    kernelSpecCancelSource.token
                );
            }

            // Try to connect to our jupyter process. Check our setting for the number of tries
            let tryCount = 0;
            const maxTries = this.configuration.getSettings(undefined).datascience.jupyterLaunchRetries;
            const stopWatch = new StopWatch();
            while (tryCount < maxTries) {
                try {
                    // Start or connect to the process
                    [connection, kernelSpecInterpreter] = await Promise.all([
                        this.startOrConnect(options, cancelToken),
                        kernelSpecInterpreterPromise
                    ]);

                    if (!connection.localLaunch && LocalHosts.includes(connection.hostName.toLowerCase())) {
                        sendTelemetryEvent(Telemetry.ConnectRemoteJupyterViaLocalHost);
                    }
                    // Create a server tha  t we will then attempt to connect to.
                    result = this.serviceContainer.get<INotebookServer>(INotebookServer);

                    // In a remote non quest situation, figure out a kernel spec too.
                    if (!kernelSpecInterpreter.kernelSpec && connection && !options?.skipSearchingForKernel) {
                        const sessionManagerFactory = this.serviceContainer.get<IJupyterSessionManagerFactory>(
                            IJupyterSessionManagerFactory
                        );
                        const sessionManager = await sessionManagerFactory.create(connection);
                        kernelSpecInterpreter = await this.kernelSelector.getKernelForRemoteConnection(
                            undefined,
                            sessionManager,
                            options?.metadata,
                            cancelToken
                        );
                        await sessionManager.dispose();
                    }

                    // If no kernel and not going to pick one, exit early
                    if (!Object.keys(kernelSpecInterpreter) && !allowUI) {
                        return undefined;
                    }

                    // Populate the launch info that we are starting our server with
                    const launchInfo: INotebookServerLaunchInfo = {
                        connectionInfo: connection!,
                        interpreter: kernelSpecInterpreter.interpreter,
                        kernelSpec: kernelSpecInterpreter.kernelSpec,
                        workingDir: options ? options.workingDir : undefined,
                        uri: options ? options.uri : undefined,
                        purpose: options ? options.purpose : uuid()
                    };

                    // tslint:disable-next-line: no-constant-condition
                    while (true) {
                        try {
                            traceInfo(
                                `Connecting to process for ${options ? options.purpose : 'unknown type of'} server`
                            );
                            await result.connect(launchInfo, cancelToken);
                            traceInfo(
                                `Connection complete for ${options ? options.purpose : 'unknown type of'} server`
                            );
                            break;
                        } catch (ex) {
                            traceError('Failed to connect to server', ex);
                            if (ex instanceof JupyterSessionStartError && isLocalConnection && allowUI) {
                                // Keep retrying, until it works or user cancels.
                                // Sometimes if a bad kernel is selected, starting a session can fail.
                                // In such cases we need to let the user know about this and prompt them to select another kernel.
                                const message = localize.DataScience.sessionStartFailedWithKernel().format(
                                    launchInfo.kernelSpec?.display_name || launchInfo.kernelSpec?.name || '',
                                    Commands.ViewJupyterOutput
                                );
                                const selectKernel = localize.DataScience.selectDifferentKernel();
                                const cancel = localize.Common.cancel();
                                const selection = await this.appShell.showErrorMessage(message, selectKernel, cancel);
                                if (selection === selectKernel) {
                                    const sessionManagerFactory = this.serviceContainer.get<
                                        IJupyterSessionManagerFactory
                                    >(IJupyterSessionManagerFactory);
                                    const sessionManager = await sessionManagerFactory.create(connection);
                                    const kernelInterpreter = await this.kernelSelector.selectLocalKernel(
                                        undefined,
                                        new StopWatch(),
                                        sessionManager,
                                        cancelToken,
                                        launchInfo.kernelSpec
                                    );
                                    if (Object.keys(kernelInterpreter).length > 0) {
                                        launchInfo.interpreter = kernelInterpreter.interpreter;
                                        launchInfo.kernelSpec =
                                            kernelInterpreter.kernelSpec || kernelInterpreter.kernelModel;
                                        continue;
                                    }
                                }
                            }
                            throw ex;
                        }
                    }

                    sendTelemetryEvent(
                        isLocalConnection ? Telemetry.ConnectLocalJupyter : Telemetry.ConnectRemoteJupyter
                    );
                    return result;
                } catch (err) {
                    // Cleanup after ourselves. server may be running partially.
                    if (result) {
                        traceInfo(`Killing server because of error ${err}`);
                        await result.dispose();
                    }
                    if (err instanceof JupyterWaitForIdleError && tryCount < maxTries) {
                        // Special case. This sometimes happens where jupyter doesn't ever connect. Cleanup after
                        // ourselves and propagate the failure outwards.
                        traceInfo('Retry because of wait for idle problem.');
                        sendTelemetryEvent(Telemetry.SessionIdleTimeout);

                        // Close existing connection.
                        connection?.dispose();
                        tryCount += 1;
                    } else if (connection) {
                        kernelSpecCancelSource.cancel();

                        // Something else went wrong
                        if (!isLocalConnection) {
                            sendTelemetryEvent(Telemetry.ConnectRemoteFailedJupyter);

                            // Check for the self signed certs error specifically
                            if (err.message.indexOf('reason: self signed certificate') >= 0) {
                                sendTelemetryEvent(Telemetry.ConnectRemoteSelfCertFailedJupyter);
                                throw new JupyterSelfCertsError(connection.baseUrl);
                            } else {
                                throw new Error(
                                    localize.DataScience.jupyterNotebookRemoteConnectFailed().format(
                                        connection.baseUrl,
                                        err
                                    )
                                );
                            }
                        } else {
                            sendTelemetryEvent(Telemetry.ConnectFailedJupyter);
                            throw new Error(
                                localize.DataScience.jupyterNotebookConnectFailed().format(connection.baseUrl, err)
                            );
                        }
                    } else {
                        kernelSpecCancelSource.cancel();
                        throw err;
                    }
                }
            }

            // If we're here, then starting jupyter timeout.
            // Kill any existing connections.
            connection?.dispose();
            sendTelemetryEvent(Telemetry.JupyterStartTimeout, stopWatch.elapsedTime, {
                timeout: stopWatch.elapsedTime
            });
            if (allowUI) {
                this.appShell
                    .showErrorMessage(localize.DataScience.jupyterStartTimedout(), localize.Common.openOutputPanel())
                    .then((selection) => {
                        if (selection === localize.Common.openOutputPanel()) {
                            this.jupyterOutputChannel.show();
                        }
                    }, noop);
            }
        }, cancelToken);
    }

    public async spawnNotebook(file: string): Promise<void> {
        return this.jupyterInterpreterService.openNotebook(file);
    }

    public async importNotebook(file: string, template: string | undefined): Promise<string> {
        return this.jupyterInterpreterService.exportNotebookToPython(file, template);
    }

    public getServer(_options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        // This is cached at the host or guest level
        return Promise.resolve(undefined);
    }

    private async verifyZMQ() {
        if (this.zmqError) {
            throw this.zmqError;
        }
        try {
            const zmq = await import('zeromq');
            const sock = new zmq.Push();
            const port = await portfinder.getPortPromise();

            await sock.bind(`tcp://127.0.0.1:${port}`);
            sock.send('some work').ignoreErrors(); // This will never return unless there's a listener. Just used for testing the API is available
            await sleep(50);
            sock.close();
            traceInfo(`ZMQ connection to port ${port} verified.`);
        } catch (e) {
            traceError(`Exception while attempting zmq :`, e);
            sendTelemetryEvent(Telemetry.ZMQNotSupported);
            this.zmqError = new JupyterZMQBinariesNotFoundError(e.toString());
            throw this.zmqError;
        }
    }
    private async startOrConnect(
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<IConnection> {
        // If our uri is undefined or if it's set to local launch we need to launch a server locally
        if (!options || !options.uri) {
            // First verify we have ZMQ installed correctly (this might change when we don't 'launch' servers anymore)
            await this.verifyZMQ();

            // If that works, then attempt to start the server
            traceInfo(`Launching ${options ? options.purpose : 'unknown type of'} server`);
            const useDefaultConfig = !options || options.skipUsingDefaultConfig ? false : true;
            const connection = await this.startNotebookServer(
                useDefaultConfig,
                this.configuration.getSettings(undefined).datascience.jupyterCommandLineArguments,
                cancelToken
            );
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
            return createRemoteConnectionInfo(options.uri, this.configuration.getSettings(undefined).datascience);
        }
    }

    // tslint:disable-next-line: max-func-body-length
    @captureTelemetry(Telemetry.StartJupyter)
    private async startNotebookServer(
        useDefaultConfig: boolean,
        customCommandLine: string[],
        cancelToken?: CancellationToken
    ): Promise<IConnection> {
        return this.notebookStarter.start(useDefaultConfig, customCommandLine, cancelToken);
    }
    private onSettingsChanged() {
        // Clear our usableJupyterInterpreter so that we recompute our values
        this.usablePythonInterpreter = undefined;
    }
}
