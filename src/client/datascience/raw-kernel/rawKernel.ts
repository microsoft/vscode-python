// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { Channels, executeRequest, ExecuteRequest, JupyterMessage } from '@nteract/messaging';
import { JSONObject } from '@phosphor/coreutils';
import { ISignal } from '@phosphor/signaling';
import { createMainChannel, JupyterConnectionInfo } from 'enchannel-zmq-backend';
import * as uuid from 'uuid/v4';
import { RawFuture } from './rawFuture';

// IANHU: Better name? Not happy with this, but want to get moving
/*
RawKernel class represents the mapping from the JupyterLab services IKernel interface
to a raw IPython kernel running on the local machine. RawKernel is in charge of taking
input request, translating them, sending them to an IPython kernel over ZMQ, then passing back the messages
*/
export class RawKernel implements Kernel.IKernel {
    private mainChannel: Channels | undefined;
    private sessionId: string | undefined;

    // Keep track of all of our active futures
    private futures = new Map<string, RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>>();

    public isDisposed: boolean = false;

    constructor() {
    }

    public async connect(connectInfo: JupyterConnectionInfo) {
        // IANHU: Also option for creating individual sockets
        if (!this.mainChannel) {
            this.sessionId = uuid();
            this.mainChannel = await createMainChannel(connectInfo, undefined, this.sessionId);
            this.mainChannel.subscribe(msg => { this.msgIn(msg) });
        }
    }

    // IANHU: Implemented
    public requestExecute(content: KernelMessage.IExecuteRequestMsg['content'], disposeOnDone?: boolean, _metadata?: JSONObject): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
        if (this.mainChannel) {
            const options = {
                store_history: content.store_history, user_expressions: content.user_expressions, allow_stdin: content.allow_stdin,
                silent: content.silent, stop_on_error: content.stop_on_error
            };

            // IANHU: This is very specific right now, need to generalize later
            const fakeExecute = this.buildJupyterMessage(content.code, options);

            this.mainChannel.next(fakeExecute);

            // IANHU: There seems to be mild type mismatches here, if I'm more or less specific
            // IANHU: Just cast to any for now and see if it breaks?
            const newFuture = new RawFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg>(fakeExecute as any, disposeOnDone || true);
            // IANHU: Cast here is ugly as well
            this.futures.set(newFuture.msg.header.msg_id, newFuture as RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>);

            return newFuture;
        }

        // IANHU: What should we do here? Throw?
        // Probably should not get here if session is not available
        throw new Error('No session available?');
    }

    public dispose(): void {
        if (!this.isDisposed) {
            // Unsub from our main channel
            if (this.mainChannel) {
                this.mainChannel.unsubscribe();
            }

            // Dispose of all our outstanding futures
            this.futures.forEach(future => { future.dispose(); });

            this.isDisposed = true;
        }
    }


    // IANHU: Don't Implement
    // IANHU: Dispose
    // IANHU: IKernel
    get terminated(): ISignal<this, void> {
        throw new Error('Not yet implemented');
    }
    get statusChanged(): ISignal<this, Kernel.Status> {
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
    get serverSettings(): ServerConnection.ISettings {
        throw new Error('Not yet implemented');
    }
    public shutdown(): Promise<void> {
        throw new Error('Not yet implemented');
    }

    // IANHU: IKernelConnection
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
        throw new Error('Not yet implemented');
    }
    get status(): Kernel.Status {
        throw new Error('Not yet implemented');
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
    getSpec(): Promise<Kernel.ISpecModel> {
        throw new Error('Not yet implemented');
    }
    sendShellMessage<T extends KernelMessage.ShellMessageType>(_msg: KernelMessage.IShellMessage<T>, _expectReply?: boolean, _disposeOnDone?: boolean): Kernel.IShellFuture<KernelMessage.IShellMessage<T>> {
        throw new Error('Not yet implemented');
    }
    sendControlMessage<T extends KernelMessage.ControlMessageType>(_msg: KernelMessage.IControlMessage<T>, _expectReply?: boolean, _disposeOnDone?: boolean): Kernel.IControlFuture<KernelMessage.IControlMessage<T>> {
        throw new Error('Not yet implemented');
    }
    reconnect(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    interrupt(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    restart(): Promise<void> {
        throw new Error('Not yet implemented');
    }
    requestKernelInfo(): Promise<KernelMessage.IInfoReplyMsg> {
        throw new Error('Not yet implemented');
    }
    requestComplete(_content: KernelMessage.ICompleteRequestMsg['content']): Promise<KernelMessage.ICompleteReplyMsg> {
        throw new Error('Not yet implemented');
    }
    requestInspect(_content: KernelMessage.IInspectRequestMsg['content']): Promise<KernelMessage.IInspectReplyMsg> {
        throw new Error('Not yet implemented');
    }
    requestHistory(_content: KernelMessage.IHistoryRequestMsg['content']): Promise<KernelMessage.IHistoryReplyMsg> {
        throw new Error('Not yet implemented');
    }
    requestDebug(_content: KernelMessage.IDebugRequestMsg['content'], _disposeOnDone?: boolean): Kernel.IControlFuture<KernelMessage.IDebugRequestMsg, KernelMessage.IDebugReplyMsg> {
        throw new Error('Not yet implemented');
    }
    requestIsComplete(_content: KernelMessage.IIsCompleteRequestMsg['content']): Promise<KernelMessage.IIsCompleteReplyMsg> {
        throw new Error('Not yet implemented');
    }
    requestCommInfo(_content: KernelMessage.ICommInfoRequestMsg['content']): Promise<KernelMessage.ICommInfoReplyMsg> {
        throw new Error('Not yet implemented');
    }
    sendInputReply(_content: KernelMessage.IInputReplyMsg['content']): void {
        throw new Error('Not yet implemented');
    }
    connectToComm(_targetName: string, _commId?: string): Kernel.IComm {
        throw new Error('Not yet implemented');
    }
    registerCommTarget(_targetName: string, _callback: (comm: Kernel.IComm, _msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>): void {
        throw new Error('Not yet implemented');
    }
    removeCommTarget(_targetName: string, _callback: (comm: Kernel.IComm, _msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>): void {
        throw new Error('Not yet implemented');
    }
    registerMessageHook(_msgId: string, _hook: (_msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    removeMessageHook(_msgId: string, _hook: (_msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }


    //IANHU: Privates
    private buildJupyterMessage(_code: string, _options: any): ExecuteRequest {
        return executeRequest('print("hello")');
    }

    // Just our quick message watcher for now
    // Think there might be a cleaner way to route these with RxJS observables later
    private msgIn(message: JupyterMessage): void {
        console.log(message);

        // IANHU: display_data messages can route based on their id here first

        // Look up in our future list and see if a future needs to be updated on this message
        if (message.parent_header.msg_id) {
            const parentFuture = this.futures.get(message.parent_header.msg_id);

            if (parentFuture) {
                parentFuture.handleMessage(message);
            } else {
                if (message.header.session == this.sessionId &&
                    message.channel !== 'iopub') {
                    // IANHU: emit unhandled
                }
            }
        }

        // IANHU: Handle general IOpub messages
    }
}