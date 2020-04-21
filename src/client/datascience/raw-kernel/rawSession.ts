// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { Kernel, KernelMessage, ServerConnection, Session } from '@jupyterlab/services';
import type { ISignal, Signal } from '@phosphor/signaling';
import * as uuid from 'uuid/v4';
import { IKernelProcess } from '../kernel-launcher/types';
import { IJMPConnection } from '../types';
import { RawKernel } from './rawKernel';

/*
RawSession class implements a jupyterlab ISession object
This provides enough of the ISession interface so that our direct
ZMQ Kernel connection can pretend to be a jupyterlab Session
*/
export class RawSession implements Session.ISession {
    public isDisposed: boolean = false;

    // Note, ID is the ID of this session
    // ClientID is the ID that we pass in messages to the kernel
    // and is also the clientID of the active kernel
    private _id: string;
    private _clientID: string;
    private _kernel: RawKernel;
    private readonly _statusChanged: Signal<this, Kernel.Status>;

    // RawSession owns the lifetime of the kernel process and will dispose it
    constructor(connection: IJMPConnection, private kernelProcess: IKernelProcess) {
        // tslint:disable-next-line: no-require-imports
        const singalling = require('@phosphor/signaling') as typeof import('@phosphor/signaling');
        this._statusChanged = new singalling.Signal<this, Kernel.Status>(this);
        // Unique ID for this session instance
        this._id = uuid();

        // ID for our client JMP connection
        this._clientID = uuid();

        // Connect our kernel and hook up status changes
        this._kernel = new RawKernel(connection, this._clientID);
        this._kernel.statusChanged.connect(this.onKernelStatus, this);
    }

    public dispose() {
        if (!this.isDisposed) {
            this._kernel.dispose();
            this.kernelProcess.dispose();
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

    // Provide status changes for the attached kernel
    get statusChanged(): ISignal<this, Kernel.Status> {
        return this._statusChanged;
    }

    // Shutdown our session and kernel
    public shutdown(): Promise<void> {
        this.dispose();
        // Normally the server session has to shutdown here with an await on a rest call
        // but we just have a local connection, so dispose and resolve
        return Promise.resolve();
    }

    // Not Implemented ISession
    get terminated(): ISignal<this, void> {
        throw new Error('Not yet implemented');
    }
    get kernelChanged(): ISignal<this, Session.IKernelChangedArgs> {
        throw new Error('Not yet implemented');
    }
    get propertyChanged(): ISignal<this, 'path' | 'name' | 'type'> {
        throw new Error('Not yet implemented');
    }
    get iopubMessage(): ISignal<this, KernelMessage.IIOPubMessage> {
        throw new Error('Not yet implemented');
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
}
