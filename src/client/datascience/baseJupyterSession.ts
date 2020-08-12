// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Kernel, KernelMessage, Session } from '@jupyterlab/services';
import type { JSONObject } from '@phosphor/coreutils';
import type { Slot } from '@phosphor/signaling';
import { Observable } from 'rxjs/Observable';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { traceError, traceInfo, traceWarning } from '../common/logger';
import { sleep, waitForPromise } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { sendTelemetryEvent } from '../telemetry';
import { Identifiers, Telemetry } from './constants';
import { JupyterInvalidKernelError } from './jupyter/jupyterInvalidKernelError';
import { JupyterWaitForIdleError } from './jupyter/jupyterWaitForIdleError';
import { JupyterKernelPromiseFailedError } from './jupyter/kernels/jupyterKernelPromiseFailedError';
import { LiveKernelModel } from './jupyter/kernels/types';
import { suppressShutdownErrors } from './raw-kernel/rawKernel';
import { IJupyterKernelSpec, IJupyterSession, ISessionWithSocket, KernelSocketInformation } from './types';

/**
 * Exception raised when starting a Jupyter Session fails.
 *
 * @export
 * @class JupyterSessionStartError
 * @extends {Error}
 */
export class JupyterSessionStartError extends Error {
    constructor(originalException: Error) {
        super(originalException.message);
        this.stack = originalException.stack;
        sendTelemetryEvent(Telemetry.StartSessionFailedJupyter);
    }
}

export abstract class BaseJupyterSession implements IJupyterSession {
    protected get session(): ISessionWithSocket | undefined {
        return this._session;
    }
    protected kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined;
    protected interpreter: PythonEnvironment | undefined;
    public get kernelSocket(): Observable<KernelSocketInformation | undefined> {
        return this._kernelSocket;
    }
    private get jupyterLab(): undefined | typeof import('@jupyterlab/services') {
        if (!this._jupyterLab) {
            // tslint:disable-next-line:no-require-imports
            this._jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services'); // NOSONAR
        }
        return this._jupyterLab;
    }

    public get onSessionStatusChanged(): Event<ServerStatus> {
        if (!this.onStatusChangedEvent) {
            this.onStatusChangedEvent = new EventEmitter<ServerStatus>();
        }
        return this.onStatusChangedEvent.event;
    }

    public get status(): ServerStatus {
        return this.getServerStatus();
    }

    public get isConnected(): boolean {
        return this.connected;
    }
    protected onStatusChangedEvent: EventEmitter<ServerStatus> = new EventEmitter<ServerStatus>();
    protected statusHandler: Slot<ISessionWithSocket, Kernel.Status>;
    protected connected: boolean = false;
    protected restartSessionPromise: Promise<ISessionWithSocket | undefined> | undefined;
    private _session: ISessionWithSocket | undefined;
    private _kernelSocket = new ReplaySubject<KernelSocketInformation | undefined>();
    private _jupyterLab?: typeof import('@jupyterlab/services');

    constructor(private restartSessionUsed: (id: Kernel.IKernelConnection) => void, public workingDirectory: string) {
        this.statusHandler = this.onStatusChanged.bind(this);
    }
    public dispose(): Promise<void> {
        return this.shutdown();
    }
    // Abstracts for each Session type to implement
    public abstract async waitForIdle(timeout: number): Promise<void>;

    public async shutdown(): Promise<void> {
        if (this.session) {
            try {
                traceInfo('Shutdown session - current session');
                await this.shutdownSession(this.session, this.statusHandler);
                traceInfo('Shutdown session - get restart session');
                if (this.restartSessionPromise) {
                    const restartSession = await this.restartSessionPromise;
                    traceInfo('Shutdown session - shutdown restart session');
                    await this.shutdownSession(restartSession, undefined);
                }
            } catch {
                noop();
            }
            this.setSession(undefined);
            this.restartSessionPromise = undefined;
        }
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.dispose();
        }
        traceInfo('Shutdown session -- complete');
    }
    public async interrupt(timeout: number): Promise<void> {
        if (this.session && this.session.kernel) {
            // Listen for session status changes
            this.session.statusChanged.connect(this.statusHandler);

            await this.waitForKernelPromise(
                this.session.kernel.interrupt(),
                timeout,
                localize.DataScience.interruptingKernelFailed()
            );
        }
    }

    public async changeKernel(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number,
        interpreter?: PythonEnvironment
    ): Promise<void> {
        let newSession: ISessionWithSocket | undefined;

        // If we are already using this kernel in an active session just return back
        if (this.session && this.kernelSpec) {
            // Name and id have to match (id is only for active sessions)
            if (this.kernelSpec.name === kernel.name && this.kernelSpec.id === kernel.id) {
                return;
            }
        }

        newSession = await this.createNewKernelSession(kernel, timeoutMS, interpreter);

        // This is just like doing a restart, kill the old session (and the old restart session), and start new ones
        if (this.session) {
            this.shutdownSession(this.session, this.statusHandler).ignoreErrors();
            this.restartSessionPromise?.then((r) => this.shutdownSession(r, undefined)).ignoreErrors(); // NOSONAR
        }

        // Update our kernel spec and interpreter
        this.kernelSpec = kernel;
        this.interpreter = interpreter;

        // Save the new session
        this.setSession(newSession);

        // Listen for session status changes
        this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

        // Start the restart session promise too.
        this.restartSessionPromise = this.createRestartSession(kernel, newSession, interpreter);
    }

    public async restart(_timeout: number): Promise<void> {
        if (this.session?.isRemoteSession) {
            await this.session.kernel.restart();
            return;
        }

        // Start the restart session now in case it wasn't started
        if (!this.restartSessionPromise) {
            this.startRestartSession();
        }

        // Just kill the current session and switch to the other
        if (this.restartSessionPromise && this.session) {
            traceInfo(`Restarting ${this.session.kernel.id}`);

            // Save old state for shutdown
            const oldSession = this.session;
            const oldStatusHandler = this.statusHandler;

            // Just switch to the other session. It should already be ready
            this.setSession(await this.restartSessionPromise);
            if (!this.session) {
                throw new Error(localize.DataScience.sessionDisposed());
            }
            this.restartSessionUsed(this.session.kernel);
            traceInfo(`Got new session ${this.session.kernel.id}`);

            // Rewire our status changed event.
            this.session.statusChanged.connect(this.statusHandler);

            // After switching, start another in case we restart again.
            this.restartSessionPromise = this.createRestartSession(this.kernelSpec, oldSession);
            traceInfo('Started new restart session');
            if (oldStatusHandler) {
                oldSession.statusChanged.disconnect(oldStatusHandler);
            }
            this.shutdownSession(oldSession, undefined).ignoreErrors();
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        disposeOnDone?: boolean,
        metadata?: JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> | undefined {
        const promise =
            this.session && this.session.kernel
                ? this.session.kernel.requestExecute(content, disposeOnDone, metadata)
                : undefined;

        // It has been observed that starting the restart session slows down first time to execute a cell.
        // Solution is to start the restart session after the first execution of user code.
        if (promise) {
            promise.done.finally(() => this.startRestartSession()).catch(noop);
        }
        return promise;
    }

    public requestInspect(
        content: KernelMessage.IInspectRequestMsg['content']
    ): Promise<KernelMessage.IInspectReplyMsg | undefined> {
        return this.session && this.session.kernel
            ? this.session.kernel.requestInspect(content)
            : Promise.resolve(undefined);
    }

    public requestComplete(
        content: KernelMessage.ICompleteRequestMsg['content']
    ): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        return this.session && this.session.kernel
            ? this.session.kernel.requestComplete(content)
            : Promise.resolve(undefined);
    }

    public sendInputReply(content: string) {
        if (this.session && this.session.kernel) {
            // tslint:disable-next-line: no-any
            this.session.kernel.sendInputReply({ value: content, status: 'ok' });
        }
    }

    public registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ) {
        if (this.session && this.session.kernel) {
            this.session.kernel.registerCommTarget(targetName, callback);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public sendCommMessage(
        buffers: (ArrayBuffer | ArrayBufferView)[],
        content: { comm_id: string; data: JSONObject; target_name: string | undefined },
        // tslint:disable-next-line: no-any
        metadata: any,
        // tslint:disable-next-line: no-any
        msgId: any
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<'comm_msg'>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        if (this.session && this.session.kernel && this.jupyterLab) {
            const shellMessage = this.jupyterLab.KernelMessage.createMessage<KernelMessage.ICommMsgMsg<'shell'>>({
                // tslint:disable-next-line: no-any
                msgType: 'comm_msg',
                channel: 'shell',
                buffers,
                content,
                metadata,
                msgId,
                session: this.session.kernel.clientId,
                username: this.session.kernel.username
            });

            return this.session.kernel.sendShellMessage(shellMessage, false, true);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    public requestCommInfo(
        content: KernelMessage.ICommInfoRequestMsg['content']
    ): Promise<KernelMessage.ICommInfoReplyMsg> {
        if (this.session?.kernel) {
            return this.session.kernel.requestCommInfo(content);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }
    public registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        if (this.session?.kernel) {
            return this.session.kernel.registerMessageHook(msgId, hook);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }
    public removeMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        if (this.session?.kernel) {
            return this.session.kernel.removeMessageHook(msgId, hook);
        } else {
            throw new Error(localize.DataScience.sessionDisposed());
        }
    }

    // Sub classes need to implement their own restarting specific code
    protected abstract startRestartSession(): void;
    protected abstract async createRestartSession(
        kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined,
        session: ISessionWithSocket,
        interpreter?: PythonEnvironment,
        cancelToken?: CancellationToken
    ): Promise<ISessionWithSocket>;

    // Sub classes need to implement their own kernel change specific code
    protected abstract createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number,
        interpreter?: PythonEnvironment
    ): Promise<ISessionWithSocket>;

    protected async waitForIdleOnSession(session: ISessionWithSocket | undefined, timeout: number): Promise<void> {
        if (session && session.kernel) {
            traceInfo(`Waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);
            // tslint:disable-next-line: no-any
            const statusHandler = (resolve: () => void, reject: (exc: any) => void, e: Kernel.Status | undefined) => {
                if (e === 'idle') {
                    resolve();
                } else if (e === 'dead') {
                    traceError('Kernel died while waiting for idle');
                    // If we throw an exception, make sure to shutdown the session as it's not usable anymore
                    this.shutdownSession(session, this.statusHandler).ignoreErrors();
                    reject(
                        new JupyterInvalidKernelError({
                            ...session.kernel,
                            lastActivityTime: new Date(),
                            numberOfConnections: 0,
                            session: session.model
                        })
                    );
                }
            };

            let statusChangeHandler: Slot<ISessionWithSocket, Kernel.Status> | undefined;
            const kernelStatusChangedPromise = new Promise((resolve, reject) => {
                statusChangeHandler = (_: ISessionWithSocket, e: Kernel.Status) => statusHandler(resolve, reject, e);
                session.statusChanged.connect(statusChangeHandler);
            });
            let kernelChangedHandler: Slot<ISessionWithSocket, Session.IKernelChangedArgs> | undefined;
            const statusChangedPromise = new Promise((resolve, reject) => {
                kernelChangedHandler = (_: ISessionWithSocket, e: Session.IKernelChangedArgs) =>
                    statusHandler(resolve, reject, e.newValue?.status);
                session.kernelChanged.connect(kernelChangedHandler);
            });
            const checkStatusPromise = new Promise(async (resolve) => {
                // This function seems to cause CI builds to timeout randomly on
                // different tests. Waiting for status to go idle doesn't seem to work and
                // in the past, waiting on the ready promise doesn't work either. Check status with a maximum of 5 seconds
                const startTime = Date.now();
                while (
                    session &&
                    session.kernel &&
                    session.kernel.status !== 'idle' &&
                    Date.now() - startTime < timeout
                ) {
                    await sleep(100);
                }
                resolve();
            });
            await Promise.race([kernelStatusChangedPromise, statusChangedPromise, checkStatusPromise]);
            traceInfo(`Finished waiting for idle on (kernel): ${session.kernel.id} -> ${session.kernel.status}`);

            if (statusChangeHandler && session && session.statusChanged) {
                session.statusChanged.disconnect(statusChangeHandler);
            }
            if (kernelChangedHandler && session && session.kernelChanged) {
                session.kernelChanged.disconnect(kernelChangedHandler);
            }

            // If we didn't make it out in ten seconds, indicate an error
            if (session.kernel && session.kernel.status === 'idle') {
                // So that we don't have problems with ipywidgets, always register the default ipywidgets comm target.
                // Restart sessions and retries might make this hard to do correctly otherwise.
                session.kernel.registerCommTarget(Identifiers.DefaultCommTarget, noop);

                return;
            }

            // If we throw an exception, make sure to shutdown the session as it's not usable anymore
            this.shutdownSession(session, this.statusHandler).ignoreErrors();
            throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
        }
    }

    // Changes the current session.
    protected setSession(session: ISessionWithSocket | undefined) {
        const oldSession = this._session;
        this._session = session;

        // If we have a new session, then emit the new kernel connection information.
        if (session && oldSession !== session) {
            if (!session.kernelSocketInformation) {
                traceError(`Unable to find WebSocket connection assocated with kernel ${session.kernel.id}`);
                this._kernelSocket.next(undefined);
            } else {
                this._kernelSocket.next({
                    options: {
                        clientId: session.kernel.clientId,
                        id: session.kernel.id,
                        model: { ...session.kernel.model },
                        userName: session.kernel.username
                    },
                    socket: session.kernelSocketInformation.socket
                });
            }
        }
    }
    protected async shutdownSession(
        session: ISessionWithSocket | undefined,
        statusHandler: Slot<ISessionWithSocket, Kernel.Status> | undefined
    ): Promise<void> {
        if (session && session.kernel) {
            const kernelId = session.kernel.id;
            traceInfo(`shutdownSession ${kernelId} - start`);
            try {
                if (statusHandler) {
                    session.statusChanged.disconnect(statusHandler);
                }
                // Do not shutdown remote sessions.
                if (session.isRemoteSession) {
                    session.dispose();
                    return;
                }
                try {
                    suppressShutdownErrors(session.kernel);
                    // Shutdown may fail if the process has been killed
                    if (!session.isDisposed) {
                        await waitForPromise(session.shutdown(), 1000);
                    }
                } catch {
                    noop();
                }
                if (session && !session.isDisposed) {
                    session.dispose();
                }
            } catch (e) {
                // Ignore, just trace.
                traceWarning(e);
            }
            traceInfo(`shutdownSession ${kernelId} - shutdown complete`);
        }
    }
    private getServerStatus(): ServerStatus {
        if (this.session) {
            switch (this.session.kernel.status) {
                case 'busy':
                    return ServerStatus.Busy;
                case 'dead':
                    return ServerStatus.Dead;
                case 'idle':
                case 'connected':
                    return ServerStatus.Idle;
                case 'restarting':
                case 'autorestarting':
                case 'reconnecting':
                    return ServerStatus.Restarting;
                case 'starting':
                    return ServerStatus.Starting;
                default:
                    return ServerStatus.NotStarted;
            }
        }

        return ServerStatus.NotStarted;
    }

    private async waitForKernelPromise(
        kernelPromise: Promise<void>,
        timeout: number,
        errorMessage: string
    ): Promise<void | null> {
        // Wait for this kernel promise to happen
        try {
            await waitForPromise(kernelPromise, timeout);
        } catch (e) {
            if (!e) {
                // We timed out. Throw a specific exception
                throw new JupyterKernelPromiseFailedError(errorMessage);
            }
            throw e;
        }
    }

    private onStatusChanged(_s: Session.ISession) {
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.fire(this.getServerStatus());
        }
    }
}
