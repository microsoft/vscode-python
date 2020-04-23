// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import type { JSONObject } from '@phosphor/coreutils';
import type { ISignal, Signal } from '@phosphor/signaling';
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');
import * as uuid from 'uuid/v4';
import { traceError } from '../../common/logger';
import { IJMPConnection } from '../types';
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
        return this._id;
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
    // Message chain to handle our messages async, but in order
    private messageChain: Promise<void> = Promise.resolve();
    // Mappings for display id tracking
    private displayIdToParentIds = new Map<string, string[]>();
    private msgIdToDisplayIds = new Map<string, string[]>();
    // The current kernel session Id that we are working with
    private kernelSession: String = '';

    private _id: string;
    private _clientId: string;
    private _status: Kernel.Status;
    private _statusChanged: Signal<this, Kernel.Status>;

    // Keep track of all of our active futures
    private futures = new Map<
        string,
        RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>
    >();

    constructor(jmpConnection: IJMPConnection, clientId: string) {
        // clientID is controlled by the session as we keep the same id
        this._clientId = clientId;
        this._id = uuid();
        this._status = 'unknown';
        // tslint:disable-next-line: no-require-imports
        const signalling = require('@phosphor/signaling') as typeof import('@phosphor/signaling');
        this._statusChanged = new signalling.Signal<this, Kernel.Status>(this);

        // Subscribe to messages coming in from our JMP channel
        this.jmpConnection = jmpConnection;
        this.jmpConnection.subscribe((message) => {
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
                this.futureDisposed(future);
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
            this.futures.forEach((future) => {
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

    // When a future is disposed this function is called to remove it from our
    // various tracking lists
    private futureDisposed(future: RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>) {
        const messageId = future.msg.header.msg_id;
        this.futures.delete(messageId);

        // Remove stored display id information.
        const displayIds = this.msgIdToDisplayIds.get(messageId);
        if (!displayIds) {
            return;
        }

        displayIds.forEach((displayId) => {
            const messageIds = this.displayIdToParentIds.get(displayId);
            if (messageIds) {
                const index = messageIds.indexOf(messageId);
                if (index === -1) {
                    return;
                }

                if (messageIds.length === 1) {
                    this.displayIdToParentIds.delete(displayId);
                } else {
                    messageIds.splice(index, 1);
                    this.displayIdToParentIds.set(displayId, messageIds);
                }
            }
        });

        // Remove our message id from the mapping to display ids
        this.msgIdToDisplayIds.delete(messageId);
    }

    // Message incoming from the JMP connection. Queue it up for processing
    private msgIn(message: KernelMessage.IMessage) {
        // Always keep our kernel session id up to date with incoming messages
        // on something like a restart this will update when the first message on the
        // new session comes in we use this to check the validity of messages that we are
        // currently handling
        this.kernelSession = message.header.session;

        // Add the message onto our message chain, we want to process them async
        // but in order so use a chain like this
        this.messageChain = this.messageChain
            .then(() => {
                // Return so any promises from each message all resolve before
                // processing the next one
                return this.handleMessage(message);
            })
            .catch((error) => {
                traceError(error);
            });
    }

    private async handleDisplayId(displayId: string, message: KernelMessage.IMessage): Promise<boolean> {
        // tslint:disable-next-line:no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

        const messageId = (message.parent_header as KernelMessage.IHeader).msg_id;

        // Get all parent ids for this display id
        let parentIds = this.displayIdToParentIds.get(displayId);

        // If we have seen this id before
        if (parentIds) {
            // We need to create a new update display data message to update the parents
            const updateMessage: KernelMessage.IMessage = {
                header: cloneDeep(message.header),
                parent_header: cloneDeep(message.parent_header),
                metadata: cloneDeep(message.metadata),
                content: cloneDeep(message.content),
                channel: message.channel,
                buffers: message.buffers ? message.buffers.slice() : []
            };
            updateMessage.header.msg_type = 'update_display_data';

            // Now send it out to all the parents
            await Promise.all(
                parentIds.map(async (parentId) => {
                    const future = this.futures && this.futures.get(parentId);
                    if (future) {
                        await future.handleMessage(updateMessage);
                    }
                })
            );
        }

        if (jupyterLab.KernelMessage.isUpdateDisplayDataMsg(message)) {
            // End here for an update display data, indicate that we have handed it
            // so it skip the normal displaying in handleMessage
            return true;
        }

        // For display_data message record the mapping from
        // the displayId to the parent messageId
        parentIds = this.displayIdToParentIds.get(displayId) ?? [];
        if (parentIds.indexOf(messageId) === -1) {
            parentIds.push(messageId);
        }
        this.displayIdToParentIds.set(displayId, parentIds);

        // Add to mapping of message -> display ids
        const displayIds = this.msgIdToDisplayIds.get(messageId) ?? [];
        if (displayIds.indexOf(messageId) === -1) {
            displayIds.push(messageId);
        }
        this.msgIdToDisplayIds.set(messageId, displayIds);

        // Return false so message continues to get processed
        return false;
    }

    /*
    Messages are handled async so there is a possibility that the kernel might be
    disposed or restarted during handling. Throw an error here if our message that
    we are handling is no longer valid.
    */
    private checkMessageValid(message: KernelMessage.IMessage) {
        if (this.isDisposed) {
            throw new Error('Stop message handling on diposed kernel');
        }

        // kernelSession is updated when the first message from a new kernel session comes in
        // in this case don't keep handling the old session messages
        if (message.header.session !== this.kernelSession) {
            throw new Error('Stop message handling on message from old session');
        }
    }

    // Handle a new message arriving from JMP connection
    private async handleMessage(message: KernelMessage.IMessage): Promise<void> {
        // tslint:disable-next-line:no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

        let handled = false;

        // Check to see if we have the right type of message for a display id
        if (
            message.parent_header &&
            message.channel === 'iopub' &&
            (jupyterLab.KernelMessage.isDisplayDataMsg(message) ||
                jupyterLab.KernelMessage.isUpdateDisplayDataMsg(message) ||
                jupyterLab.KernelMessage.isExecuteResultMsg(message))
        ) {
            // Display id can be found in transient message content
            // https://jupyter-client.readthedocs.io/en/stable/messaging.html#display-data
            const displayId = message.content.transient?.display_id;
            if (displayId) {
                handled = await this.handleDisplayId(displayId, message);

                // After await check the validity of our message
                this.checkMessageValid(message);
            }
        }

        // Look up in our future list and see if a future needs to be updated on this message
        if (!handled && message.parent_header) {
            const parentHeader = message.parent_header as KernelMessage.IHeader;
            const parentFuture = this.futures.get(parentHeader.msg_id);

            if (parentFuture) {
                // Let the parent future message handle it here
                await parentFuture.handleMessage(message);

                // After await check the validity of our message
                this.checkMessageValid(message);
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
