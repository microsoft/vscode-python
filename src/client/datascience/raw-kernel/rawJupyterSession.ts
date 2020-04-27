// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationTokenSource } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { CancellationError, createPromiseFromCancellation } from '../../common/cancellation';
import { traceError, traceInfo } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { createDeferred, sleep, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { BaseJupyterSession, ISession } from '../baseJupyterSession';
import { Telemetry } from '../constants';
import { KernelSelector } from '../jupyter/kernels/kernelSelector';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from '../kernel-launcher/types';
import { reportAction } from '../progress/decorator';
import { ReportableAction } from '../progress/types';
import { RawSession } from '../raw-kernel/rawSession';
import { IJMPConnection, IJupyterKernelSpec } from '../types';

/*
RawJupyterSession is the implementation of IJupyterSession that instead of
connecting to JupyterLab services it instead connect    s to a kernel directly
through ZMQ.
It's responsible for translating our IJupyterSession interface into the
jupyterlabs interface as well as starting up and connecting to a raw session
*/
export class RawJupyterSession extends BaseJupyterSession {
    private _disposables: IDisposable[] = [];
    constructor(
        private readonly kernelLauncher: IKernelLauncher,
        private readonly serviceContainer: IServiceContainer,
        kernelSelector: KernelSelector
    ) {
        super(kernelSelector);
    }

    @reportAction(ReportableAction.JupyterSessionWaitForIdleSession)
    public async waitForIdle(_timeout: number): Promise<void> {
        // RawKernels are good to go right away
    }
    public async dispose(): Promise<void> {
        this._disposables.forEach((d) => d.dispose());
        await super.dispose();
    }
    // Connect to the given kernelspec, which should already have ipykernel installed into its interpreter
    @captureTelemetry(Telemetry.RawKernelSessionConnect, undefined, true)
    public async connect(
        kernelSpec: IJupyterKernelSpec,
        timeout: number,
        cancelToken?: CancellationToken
    ): Promise<void> {
        try {
            // Try to start up our raw session, allow for cancellation or timeout
            // Notebook Provider level will handle the thrown error
            const newSession = await waitForPromise(
                Promise.race([
                    this.startRawSession(kernelSpec, cancelToken),
                    createPromiseFromCancellation({
                        cancelAction: 'reject',
                        defaultValue: new CancellationError(),
                        token: cancelToken
                    })
                ]),
                timeout
            );

            // Only connect our session if we didn't cancel or timeout
            if (newSession instanceof CancellationError) {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartUserCancel);
                traceInfo('Starting of raw session cancelled by user');
                throw newSession;
            } else if (newSession === null) {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartTimeout);
                traceError('Raw session failed to start in given timeout');
                throw new Error(localize.DataScience.sessionDisposed());
            } else {
                sendTelemetryEvent(Telemetry.RawKernelSessionStartSuccess);
                traceInfo('Raw session started and connected');
                this.session = newSession;
                this.kernelSpec = newSession.process?.kernelSpec;
            }
        } catch (error) {
            sendTelemetryEvent(Telemetry.RawKernelSessionStartException);
            traceError(`Failed to connect raw kernel session: ${error}`);
            this.connected = false;
            throw error;
        }

        // Start our restart session at this point
        this.startRestartSession();

        this.connected = true;
    }

    public async createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number
    ): Promise<ISession> {
        if (!kernel || 'session' in kernel) {
            // Don't allow for connecting to a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }

        let sessionCreated = false;
        const cancellation = new CancellationTokenSource();
        const timeoutPromise = createDeferred<never>();

        // tslint:disable-next-line: no-any
        const timer: any = setTimeout(() => {
            // const timeoutPromise = sleep(timeoutMS).then(() => {
            // To ignore dangling promises failing and not being handled.
            if (sessionCreated) {
                return;
            }
            // tslint:disable-next-line: no-any
            const cancelTimer: any = setTimeout(() => cancellation.cancel(), 0);
            this._disposables.push({ dispose: () => clearTimeout(cancelTimer) });
            timeoutPromise.reject(new Error('Timeout waiting to create a new Kernel'));
        }, timeoutMS);

        // No dangling resources.
        this._disposables.push({ dispose: cancellation.cancel.bind(cancellation) });
        this._disposables.push({ dispose: () => clearTimeout(timer) });

        const promise = Promise.race([this.startRawSession(kernel, cancellation.token), timeoutPromise.promise]);
        promise.then(() => (sessionCreated = true)).catch(noop);
        return promise;
    }

    protected startRestartSession() {
        if (!this.restartSessionPromise && this.session) {
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec, this.session);
        }
    }
    protected async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        _session: ISession,
        cancelToken?: CancellationToken
    ): Promise<ISession> {
        if (!kernelSpec || 'session' in kernelSpec) {
            // Need to have connected before restarting and can't use a LiveKernelModel
            throw new Error(localize.DataScience.sessionDisposed());
        }
        const startPromise = this.startRawSession(kernelSpec, cancelToken);
        return startPromise.then((session) => {
            this.kernelSelector.addKernelToIgnoreList(session.kernel);
            return session;
        });
    }

    @captureTelemetry(Telemetry.RawKernelStartRawSession, undefined, true)
    private async startRawSession(kernelSpec: IJupyterKernelSpec, cancelToken?: CancellationToken): Promise<ISession> {
        const cancellationPromise = createPromiseFromCancellation({
            cancelAction: 'reject',
            defaultValue: undefined,
            token: cancelToken
        }) as Promise<never>;
        cancellationPromise.catch(noop);

        const process = await Promise.race([this.kernelLauncher.launch(kernelSpec), cancellationPromise]);
        const processExited = createDeferred<{ exitCode?: number; reason?: string }>();
        const exitedHandler = process.exited((e) => processExited.resolve(e));
        this._disposables.push(exitedHandler);
        let sessionCreated = false;

        const throwErrorIfProcessExited = async () => {
            const exitInfo = await new Promise<{
                exitCode?: number | undefined;
                reason?: string | undefined;
            }>((resolve) => process.exited(resolve));

            if (sessionCreated) {
                return;
            }
            throw new Error(
                `${localize.DataScience.rawKernelProcessExitBeforeConnect()}, exit code: ${
                    exitInfo.exitCode
                }, reason: ${exitInfo.reason}`
            );
        };

        const processExitedPromise = throwErrorIfProcessExited();
        // We don't want any dangling promises.
        // tslint:disable-next-line: no-console
        processExitedPromise.catch(noop);

        try {
            const connectPromise = this.jmpConnection(process.connection, process);
            const promise = Promise.race([connectPromise, processExitedPromise, cancellationPromise]);
            // Track whether we created a session.
            promise.then(() => (sessionCreated = true)).catch(noop);
            // Safe as `connectPromise` when resolved will only return a session.
            // tslint:disable-next-line: no-any
            return promise as any;
        } catch (ex) {
            // If there is an error in connecting to the kernel, then ensure we dispose the kernel.
            await process.dispose();
            throw ex;
        }
    }

    // Create and connect our JMP (Jupyter Messaging Protocol) for talking to the raw kernel
    private async jmpConnection(kernelConnection: IKernelConnection, process: IKernelProcess) {
        const connection = this.serviceContainer.get<IJMPConnection>(IJMPConnection);

        await connection.connect(kernelConnection);

        // Create our raw session, it will own the process lifetime
        const session: ISession = new RawSession(connection, process);
        session.isRemoteSession = false;
        session.process = process;
        return session;
    }
}
