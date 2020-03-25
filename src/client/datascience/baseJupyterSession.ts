// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage, Session } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { Slot } from '@phosphor/signaling';
import { Event, EventEmitter } from 'vscode';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { waitForPromise } from '../common/utils/async';
import * as localize from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { Telemetry } from './constants';
import { JupyterKernelPromiseFailedError } from './jupyter/kernels/jupyterKernelPromiseFailedError';
import { LiveKernelModel } from './jupyter/kernels/types';
import { IJupyterKernelSpec, IJupyterSession } from './types';

export type ISession = Session.ISession & {
    /**
     * Whether this is a remote session that we attached to.
     *
     * @type {boolean}
     */
    isRemoteSession?: boolean;
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

/*
BaseJupyterSession represention functionality shared by a session regardless of if you are connected to a 
server via JupyterLabs interfaces or via a raw ZMQ connection to a kernel. Raw classes implement the 
jupyterlab interfaces so shared functionality that goes through the ISession or IKernel should go in here
*/
export abstract class BaseJupyterSession implements IJupyterSession {
    protected session: ISession | undefined;
    protected connected: boolean = false;
    protected onStatusChangedEvent: EventEmitter<ServerStatus> = new EventEmitter<ServerStatus>();
    protected statusHandler: Slot<ISession, Kernel.Status>;

    constructor() {
        this.statusHandler = this.onStatusChanged.bind(this);
    }

    // Abstracts for each Session type to implement
    public abstract async shutdown(): Promise<void>;
    public abstract async restart(timeout: number): Promise<void>;
    public abstract async changeKernel(kernel: IJupyterKernelSpec | LiveKernelModel, timeoutMS: number): Promise<void>;
    public abstract async waitForIdle(timeout: number): Promise<void>;

    // When we are disposed, call our shutdown function
    public dispose(): Promise<void> {
        return this.shutdown();
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

    // Return if we are connected to an active kernel
    public get isConnected(): boolean {
        return this.connected;
    }

    // Return the current kernel status of our server
    public get status(): ServerStatus {
        return this.getServerStatus();
    }

    // Event for server status changes
    public get onSessionStatusChanged(): Event<ServerStatus> {
        if (!this.onStatusChangedEvent) {
            this.onStatusChangedEvent = new EventEmitter<ServerStatus>();
        }
        return this.onStatusChangedEvent.event;
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

    // Respond to status changes on the session
    protected onStatusChanged(_s: Session.ISession) {
        if (this.onStatusChangedEvent) {
            this.onStatusChangedEvent.fire(this.getServerStatus());
        }
    }

    private async waitForKernelPromise(
        kernelPromise: Promise<void>,
        timeout: number,
        errorMessage: string
    ): Promise<void> {
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
}
