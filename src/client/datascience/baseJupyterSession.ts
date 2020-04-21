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
import { isTestExecution } from '../common/constants';
import { traceError, traceInfo, traceWarning } from '../common/logger';
import { IDisposable } from '../common/types';
import { waitForPromise } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { sendTelemetryEvent } from '../telemetry';
import { Telemetry } from './constants';
import { JupyterWebSockets } from './jupyter/jupyterWebSocket';
import { JupyterKernelPromiseFailedError } from './jupyter/kernels/jupyterKernelPromiseFailedError';
import { KernelSelector } from './jupyter/kernels/kernelSelector';
import { LiveKernelModel } from './jupyter/kernels/types';
import { IKernelProcess } from './kernel-launcher/types';
import { IJupyterKernelSpec, IJupyterSession, KernelSocketInformation } from './types';

export type ISession = Session.ISession & {
    // Whether this is a remote session that we attached to.
    isRemoteSession?: boolean;
    // If a kernel process is associated with this session
    process?: IKernelProcess;
};

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
    protected get session(): ISession | undefined {
        return this._session;
    }
    protected set session(session: ISession | undefined) {
        const oldSession = this._session;
        this._session = session;

        // When setting the session clear our current exit handler and hook up to the
        // new session process
        if (this.processExitHandler) {
            this.processExitHandler.dispose();
            this.processExitHandler = undefined;
        }
        if (session?.process) {
            // Watch to see if our process exits
            this.processExitHandler = session.process.exited((exitCode) => {
                traceError(`Raw kernel process exited code: ${exitCode}`);
                this.shutdown().catch((reason) => {
                    traceError(`Error shutting down jupyter session: ${reason}`);
                });
                // Next code the user executes will show a session disposed message
            });
        }

        // If we have a new session, then emit the new kernel connection information.
        if (session && oldSession !== session) {
            const socket = JupyterWebSockets.get(session.kernel.id);
            if (!socket) {
                traceError(`Unable to find WebSocket connetion assocated with kerne ${session.kernel.id}`);
                this._kernelSocket.next(undefined);
                return;
            }
            this._kernelSocket.next({
                options: {
                    clientId: session.kernel.clientId,
                    id: session.kernel.id,
                    model: { ...session.kernel.model },
                    userName: session.kernel.username
                },
                socket: socket
            });
        }
    }
    protected kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined;
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
    protected statusHandler: Slot<ISession, Kernel.Status>;
    protected connected: boolean = false;
    protected restartSessionPromise: Promise<ISession | undefined> | undefined;
    private _session: ISession | undefined;
    private _kernelSocket = new ReplaySubject<KernelSocketInformation | undefined>();
    private _jupyterLab?: typeof import('@jupyterlab/services');
    private processExitHandler: IDisposable | undefined;

    constructor(protected readonly kernelSelector: KernelSelector) {
        this.statusHandler = this.onStatusChanged.bind(this);
    }
    public dispose(): Promise<void> {
        if (this.processExitHandler) {
            this.processExitHandler.dispose();
            this.processExitHandler = undefined;
        }
        return this.shutdown();
    }
    // Abstracts for each Session type to implement
    public abstract async waitForIdle(timeout: number): Promise<void>;

    public async shutdown(): Promise<void> {
        if (this.processExitHandler) {
            this.processExitHandler.dispose();
            this.processExitHandler = undefined;
        }

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
            this.session = undefined;
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

    public async changeKernel(kernel: IJupyterKernelSpec | LiveKernelModel, timeoutMS: number): Promise<void> {
        let newSession: ISession | undefined;

        // If we are already using this kernel in an active session just return back
        if (this.kernelSpec?.name === kernel.name && this.session) {
            return;
        }

        newSession = await this.createNewKernelSession(kernel, timeoutMS);

        // This is just like doing a restart, kill the old session (and the old restart session), and start new ones
        if (this.session) {
            this.shutdownSession(this.session, this.statusHandler).ignoreErrors();
            this.restartSessionPromise?.then((r) => this.shutdownSession(r, undefined)).ignoreErrors(); // NOSONAR
        }

        // Update our kernel spec
        this.kernelSpec = kernel;

        // Save the new session
        this.session = newSession;

        // Listen for session status changes
        this.session?.statusChanged.connect(this.statusHandler); // NOSONAR

        // Start the restart session promise too.
        this.restartSessionPromise = this.createRestartSession(kernel, this.session);
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
            this.session = await this.restartSessionPromise;
            if (!this.session) {
                throw new Error(localize.DataScience.sessionDisposed());
            }
            this.kernelSelector.removeKernelFromIgnoreList(this.session.kernel);
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
        return this.session && this.session.kernel
            ? this.session.kernel.requestExecute(content, disposeOnDone, metadata)
            : undefined;
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
        session: ISession,
        cancelToken?: CancellationToken
    ): Promise<ISession>;

    // Sub classes need to implement their own kernel change specific code
    protected abstract createNewKernelSession(
        kernel: IJupyterKernelSpec | LiveKernelModel,
        timeoutMS: number
    ): Promise<ISession>;

    protected async shutdownSession(
        session: ISession | undefined,
        statusHandler: Slot<ISession, Kernel.Status> | undefined
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
                    // When running under a test, mark all futures as done so we
                    // don't hit this problem:
                    // https://github.com/jupyterlab/jupyterlab/issues/4252
                    // tslint:disable:no-any
                    if (isTestExecution()) {
                        const defaultKernel = session.kernel as any;
                        if (defaultKernel && defaultKernel._futures) {
                            const futures = defaultKernel._futures as Map<any, any>;
                            if (futures) {
                                futures.forEach((f) => {
                                    if (f._status !== undefined) {
                                        f._status |= 4;
                                    }
                                });
                            }
                        }
                        if (defaultKernel && defaultKernel._reconnectLimit) {
                            defaultKernel._reconnectLimit = 0;
                        }
                        await waitForPromise(session.shutdown(), 1000);
                    } else {
                        // Shutdown may fail if the process has been killed
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
            return await waitForPromise(kernelPromise, timeout);
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
