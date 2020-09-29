// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { Kernel, KernelMessage, ServerConnection, Session } from '@jupyterlab/services';
import type { ISignal, Signal } from '@phosphor/signaling';
import * as uuid from 'uuid/v4';
import '../../common/extensions';
import { traceError } from '../../common/logger';
import { IDisposable } from '../../common/types';
import { IKernelProcess } from '../kernel-launcher/types';
import { ISessionWithSocket, KernelSocketInformation } from '../types';
import { createRawKernel, RawKernel } from './rawKernel';

/*
RawSession class implements a jupyterlab ISession object
This provides enough of the ISession interface so that our direct
ZMQ Kernel connection can pretend to be a jupyterlab Session
*/
export class RawSession implements ISessionWithSocket {
    public isDisposed: boolean = false;
    private isDisposing?: boolean;

    // Note, ID is the ID of this session
    // ClientID is the ID that we pass in messages to the kernel
    // and is also the clientID of the active kernel
    private _id: string;
    private _clientID: string;
    private _kernel: RawKernel;
    private readonly _statusChanged: Signal<this, Kernel.Status>;
    private readonly _kernelChanged: Signal<this, Session.IKernelChangedArgs>;
    private readonly _ioPubMessage: Signal<this, KernelMessage.IIOPubMessage>;
    private readonly exitHandler: IDisposable;

    // RawSession owns the lifetime of the kernel process and will dispose it
    constructor(public kernelProcess: IKernelProcess) {
        // tslint:disable-next-line: no-require-imports
        const signaling = require('@phosphor/signaling') as typeof import('@phosphor/signaling');
        this._statusChanged = new signaling.Signal<this, Kernel.Status>(this);
        this._kernelChanged = new signaling.Signal<this, Session.IKernelChangedArgs>(this);
        this._ioPubMessage = new signaling.Signal<this, KernelMessage.IIOPubMessage>(this);
        // Unique ID for this session instance
        this._id = uuid();

        // ID for our client JMP connection
        this._clientID = uuid();

        // Connect our kernel and hook up status changes
        this._kernel = createRawKernel(kernelProcess, this._clientID);
        this._kernel.statusChanged.connect(this.onKernelStatus, this);
        this._kernel.iopubMessage.connect(this.onIOPubMessage, this);
        this.exitHandler = kernelProcess.exited(this.handleUnhandledExitingOfKernelProcess, this);
    }

    public async dispose() {
        this.isDisposing = true;
        if (!this.isDisposed) {
            this.exitHandler.dispose();
            await this._kernel.shutdown();
            this._kernel.dispose();
            this.kernelProcess.dispose().ignoreErrors();
        }
        this.isDisposed = true;
    }

    // Return the ID, this is session's ID, not clientID for messages
    get id(): string {
        return this._id;
    }

    // Return the current kernel for this session
    get kernel(): Kernel.IKernelConnection {
        return this._kernel;
    }

    get kernelSocketInformation(): KernelSocketInformation | undefined {
        return {
            socket: this._kernel.socket,
            options: {
                id: this._kernel.id,
                clientId: this._clientID,
                userName: '',
                model: this._kernel.model
            }
        };
    }

    // Provide status changes for the attached kernel
    get statusChanged(): ISignal<this, Kernel.Status> {
        return this._statusChanged;
    }

    // Shutdown our session and kernel
    public shutdown(): Promise<void> {
        return this.dispose();
    }

    // Not Implemented ISession
    get terminated(): ISignal<this, void> {
        throw new Error('Not yet implemented');
    }
    get kernelChanged(): ISignal<this, Session.IKernelChangedArgs> {
        return this._kernelChanged;
    }
    get propertyChanged(): ISignal<this, 'path' | 'name' | 'type'> {
        throw new Error('Not yet implemented');
    }
    get iopubMessage(): ISignal<this, KernelMessage.IIOPubMessage> {
        return this._ioPubMessage;
    }
    get unhandledMessage(): ISignal<this, KernelMessage.IMessage> {
        throw new Error('Not yet implemented');
    }
    get anyMessage(): ISignal<this, Kernel.IAnyMessageArgs> {
        throw new Error('Not yet implemented');
    }
    get path(): string {
        throw new Error('Not yet implemented');
    }
    get name(): string {
        throw new Error('Not yet implemented');
    }
    get type(): string {
        throw new Error('Not yet implemented');
    }
    get serverSettings(): ServerConnection.ISettings {
        throw new Error('Not yet implemented');
    }
    get model(): Session.IModel {
        throw new Error('Not yet implemented');
    }
    get status(): Kernel.Status {
        throw new Error('Not yet implemented');
    }
    public setPath(_path: string): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public setName(_name: string): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public setType(_type: string): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public changeKernel(_options: Partial<Kernel.IModel>): Promise<Kernel.IKernelConnection> {
        throw new Error('Not yet implemented');
    }

    // Private
    // Send out a message when our kernel changes state
    private onKernelStatus(_sender: Kernel.IKernelConnection, state: Kernel.Status) {
        this._statusChanged.emit(state);
    }
    private onIOPubMessage(_sender: Kernel.IKernelConnection, msg: KernelMessage.IIOPubMessage) {
        this._ioPubMessage.emit(msg);
    }
    private handleUnhandledExitingOfKernelProcess(e: { exitCode?: number | undefined; reason?: string | undefined }) {
        if (this.isDisposing) {
            return;
        }
        traceError(`Disposing session as kernel process died ExitCode: ${e.exitCode}, Reason: ${e.reason}`);
        // Just kill the session.
        this.dispose().ignoreErrors();
    }
}
