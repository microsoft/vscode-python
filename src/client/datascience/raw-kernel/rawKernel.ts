// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { ISignal, Signal } from '@phosphor/signaling';
import * as uuid from 'uuid/v4';
import { traceError } from '../../common/logger';
import { IJMPConnection, IJMPConnectionInfo } from '../types';
import { RawFuture } from './rawFuture';

/*
RawKernel class represents the mapping from the JupyterLab services IKernel interface
to a raw IPython kernel running on the local machine. RawKernel is in charge of taking
input request, translating them, sending them to an IPython kernel over ZMQ, then passing back the messages
*/
export class RawKernel implements Kernel.IKernel {
    // IKernel properties
    get terminated(): ISignal<this, void> {
        throw new Error('Not yet implemented');
    }
    get statusChanged(): ISignal<this, Kernel.Status> {
        return this._statusChanged;
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
    get serverSettings(): ServerConnection.ISettings {
        throw new Error('Not yet implemented');
    }

    // IKernelConnection properties
    get id(): string {
        throw new Error('Not yet implemented');
    }
    get name(): string {
        throw new Error('Not yet implemented');
    }
    get model(): Kernel.IModel {
        throw new Error('Not yet implemented');
    }
    get username(): string {
        throw new Error('Not yet implemented');
    }
    get clientId(): string {
        return this._clientId;
    }
    get status(): Kernel.Status {
        return this._status;
    }
    get info(): KernelMessage.IInfoReply | null {
        throw new Error('Not yet implemented');
    }
    get isReady(): boolean {
        throw new Error('Not yet implemented');
    }
    get ready(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    get handleComms(): boolean {
        throw new Error('Not yet implemented');
    }

    public isDisposed: boolean = false;
    private jmpConnection: IJMPConnection;
    private messageChain: Promise<void> = Promise.resolve();

    private _clientId: string;
    private _status: Kernel.Status;
    private _statusChanged: Signal<this, Kernel.Status>;

    // Keep track of all of our active futures
    private futures = new Map<
        string,
        RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>
    >();

    // JMP connection should be injected, but no need to yet until it actually exists
    constructor(connection: IJMPConnection) {
        this._clientId = uuid();
        this._status = 'unknown';
        this._statusChanged = new Signal<this, Kernel.Status>(this);
        this.jmpConnection = connection;
    }

    public async connect(connectInfo: IJMPConnectionInfo) {
        await this.jmpConnection.connect(connectInfo);
        this.jmpConnection.subscribe(message => {
            this.msgIn(message);
        });
    }

    public requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        disposeOnDone?: boolean,
        _metadata?: JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
        if (this.jmpConnection) {
            // tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

            // Build our execution message
            // Silent is supposed to be options, but in my testing the message was not passing
            // correctly without it, so specifying it here with default false
            const executeOptions: KernelMessage.IOptions<KernelMessage.IExecuteRequestMsg> = {
                session: this._clientId,
                channel: 'shell',
                msgType: 'execute_request',
                username: 'vscode',
                content: { ...content, silent: content.silent || false }
            };
            const executeMessage = jupyterLab.KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>(
                executeOptions
            );

            const newFuture = this.sendShellMessage(executeMessage, true, disposeOnDone || true);

            return newFuture as Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg>;
        }

        // RAWKERNEL: What should we do here? Throw?
        // Probably should not get here if session is not available
        throw new Error('No session available?');
    }

    public requestComplete(
        content: KernelMessage.ICompleteRequestMsg['content']
    ): Promise<KernelMessage.ICompleteReplyMsg> {
        if (this.jmpConnection) {
            // tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

            const completeOptions: KernelMessage.IOptions<KernelMessage.ICompleteRequestMsg> = {
                session: this._clientId,
                channel: 'shell',
                msgType: 'complete_request',
                username: 'vscode',
                content
            };
            const completeMessage = jupyterLab.KernelMessage.createMessage<KernelMessage.ICompleteRequestMsg>(
                completeOptions
            );

            return this.sendShellMessage(completeMessage, true).done as Promise<KernelMessage.ICompleteReplyMsg>;
        }

        // RAWKERNEL: What should we do here? Throw?
        // Probably should not get here if session is not available
        throw new Error('No session available?');
    }

    public requestInspect(
        content: KernelMessage.IInspectRequestMsg['content']
    ): Promise<KernelMessage.IInspectReplyMsg> {
        if (this.jmpConnection) {
            // tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

            const inspectOptions: KernelMessage.IOptions<KernelMessage.IInspectRequestMsg> = {
                session: this._clientId,
                channel: 'shell',
                msgType: 'inspect_request',
                username: 'vscode',
                content
            };
            const inspectMessage = jupyterLab.KernelMessage.createMessage<KernelMessage.IInspectRequestMsg>(
                inspectOptions
            );

            return this.sendShellMessage(inspectMessage, true).done as Promise<KernelMessage.IInspectReplyMsg>;
        }

        // RAWKERNEL: What should we do here? Throw?
        // Probably should not get here if session is not available
        throw new Error('No session available?');
    }

    public sendShellMessage<T extends KernelMessage.ShellMessageType>(
        message: KernelMessage.IShellMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IShellFuture<KernelMessage.IShellMessage<T>> {
        if (this.jmpConnection) {
            // First send our message
            this.jmpConnection.sendMessage(message);

            // Next we need to build our future
            const future = new RawFuture(message, expectReply || false, disposeOnDone || true);

            // RAWKERNEL: DisplayID calculations need to happen here
            this.futures.set(message.header.msg_id, future);

            // Set our future to remove itself when disposed
            const oldDispose = future.dispose.bind(future);
            future.dispose = () => {
                this.futures.delete(future.msg.header.msg_id);
                return oldDispose();
            };

            return future as Kernel.IShellFuture<KernelMessage.IShellMessage<T>>;
        }

        // RAWKERNEL: sending without a connection
        throw new Error('Attemping to send shell message without connection');
    }

    public sendInputReply(content: KernelMessage.IInputReplyMsg['content']): void {
        if (this.jmpConnection) {
            // tslint:disable-next-line:no-require-imports
            const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');
            const inputOptions: KernelMessage.IOptions<KernelMessage.IInputReplyMsg> = {
                session: this.clientId,
                channel: 'stdin',
                msgType: 'input_reply',
                content
            };
            const inputReplyMessage = jupyterLab.KernelMessage.createMessage<KernelMessage.IInputReplyMsg>(
                inputOptions
            );

            // Send off our input reply no futures or promises
            this.jmpConnection.sendMessage(inputReplyMessage);
        }
    }

    // On dispose close down our connection and get rid of saved futures
    public dispose(): void {
        if (!this.isDisposed) {
            if (this.jmpConnection) {
                this.jmpConnection.dispose();
            }

            // Dispose of all our outstanding futures
            this.futures.forEach(future => {
                future.dispose();
            });
            this.futures.clear();

            this.isDisposed = true;
        }
    }
    public shutdown(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public getSpec(): Promise<Kernel.ISpecModel> {
        throw new Error('Not yet implemented');
    }
    public sendControlMessage<T extends KernelMessage.ControlMessageType>(
        _msg: KernelMessage.IControlMessage<T>,
        _expectReply?: boolean,
        _disposeOnDone?: boolean
    ): Kernel.IControlFuture<KernelMessage.IControlMessage<T>> {
        throw new Error('Not yet implemented');
    }
    public reconnect(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public interrupt(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public restart(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    public requestKernelInfo(): Promise<KernelMessage.IInfoReplyMsg> {
        throw new Error('Not yet implemented');
    }
    public requestHistory(
        _content: KernelMessage.IHistoryRequestMsg['content']
    ): Promise<KernelMessage.IHistoryReplyMsg> {
        throw new Error('Not yet implemented');
    }
    public requestDebug(
        _content: KernelMessage.IDebugRequestMsg['content'],
        _disposeOnDone?: boolean
    ): Kernel.IControlFuture<KernelMessage.IDebugRequestMsg, KernelMessage.IDebugReplyMsg> {
        throw new Error('Not yet implemented');
    }
    public requestIsComplete(
        _content: KernelMessage.IIsCompleteRequestMsg['content']
    ): Promise<KernelMessage.IIsCompleteReplyMsg> {
        throw new Error('Not yet implemented');
    }
    public requestCommInfo(
        _content: KernelMessage.ICommInfoRequestMsg['content']
    ): Promise<KernelMessage.ICommInfoReplyMsg> {
        throw new Error('Not yet implemented');
    }
    public connectToComm(_targetName: string, _commId?: string): Kernel.IComm {
        throw new Error('Not yet implemented');
    }
    public registerCommTarget(
        _targetName: string,
        _callback: (comm: Kernel.IComm, _msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void {
        throw new Error('Not yet implemented');
    }
    public removeCommTarget(
        _targetName: string,
        _callback: (comm: Kernel.IComm, _msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void {
        throw new Error('Not yet implemented');
    }
    public registerMessageHook(
        _msgId: string,
        _hook: (_msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        throw new Error('Not yet implemented');
    }
    public removeMessageHook(
        _msgId: string,
        _hook: (_msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        throw new Error('Not yet implemented');
    }

    // Message incoming from the JMP connection. Queue it up for processing
    private msgIn(message: KernelMessage.IMessage) {
        // Add the message onto our message chain, we want to process them async
        // but in order so use a chain like this
        this.messageChain = this.messageChain
            .then(() => {
                // Return so any promises from each message all resolve before
                // processing the next one
                return this.handleMessage(message);
            })
            .catch(error => {
                traceError(error);
            });
    }

    // Handle a new message arriving from JMP connection
    private async handleMessage(message: KernelMessage.IMessage): Promise<void> {
        // RAWKERNEL: display_data messages can route based on their id here first

        // Look up in our future list and see if a future needs to be updated on this message
        if (message.parent_header) {
            const parentHeader = message.parent_header as KernelMessage.IHeader;
            const parentFuture = this.futures.get(parentHeader.msg_id);

            if (parentFuture) {
                // Let the parent future message handle it here
                await parentFuture.handleMessage(message);
            } else {
                if (message.header.session === this._clientId && message.channel !== 'iopub') {
                    // RAWKERNEL: emit unhandled
                }
            }
        }

        // Check for ioPub status messages
        if (message.channel === 'iopub' && message.header.msg_type === 'status') {
            const newStatus = (message as KernelMessage.IStatusMsg).content.execution_state;
            this.updateStatus(newStatus);
        }
    }

    // The status for our kernel has changed
    private updateStatus(newStatus: Kernel.Status) {
        if (this._status === newStatus || this._status === 'dead') {
            return;
        }

        this._status = newStatus;
        this._statusChanged.emit(newStatus);
        if (newStatus === 'dead') {
            this.dispose();
        }
    }
}
