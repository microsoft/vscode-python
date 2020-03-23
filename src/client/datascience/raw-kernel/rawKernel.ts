// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { ISignal } from '@phosphor/signaling';
import * as uuid from 'uuid/v4';
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

    public isDisposed: boolean = false;
    private jmpConnection: IJMPConnection;
    private sessionId: string | undefined;

    // Keep track of all of our active futures
    private futures = new Map<
        string,
        RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>
    >();

    // JMP connection should be injected, but no need to yet until it actually exists
    constructor(connection: IJMPConnection) {
        this.jmpConnection = connection;
    }

    public async connect(connectInfo: IJMPConnectionInfo) {
        this.sessionId = uuid();
        await this.jmpConnection.connect(connectInfo, this.sessionId);
        this.jmpConnection.subscribe(msg => {
            this.handleMessage(msg).ignoreErrors();
        });
    }

    public requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        disposeOnDone?: boolean,
        _metadata?: JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
        if (this.jmpConnection && this.sessionId) {
            // Build our execution message
            // Silent is supposed to be options, but in my testing the message was not passing
            // correctly without it, so specifying it here with default false
            const executeOptions: KernelMessage.IOptions<KernelMessage.IExecuteRequestMsg> = {
                session: this.sessionId,
                channel: 'shell',
                msgType: 'execute_request',
                username: 'vscode',
                content: { ...content, silent: content.silent || false }
            };
            const executeMessage = KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>(executeOptions);

            // Send off our message to our jmp connection
            this.jmpConnection.sendMessage(executeMessage);

            // Create a future to watch for reply messages
            const newFuture = new RawFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg>(
                executeMessage,
                disposeOnDone || true
            );
            this.futures.set(
                newFuture.msg.header.msg_id,
                newFuture as RawFuture<KernelMessage.IShellControlMessage, KernelMessage.IShellControlMessage>
            );

            // Set our future to remove itself when disposed
            const oldDispose = newFuture.dispose.bind(newFuture);
            newFuture.dispose = () => {
                this.futures.delete(newFuture.msg.header.msg_id);
                return oldDispose();
            };

            return newFuture;
        }

        // RAWKERNEL: What should we do here? Throw?
        // Probably should not get here if session is not available
        throw new Error('No session available?');
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
    public sendShellMessage<T extends KernelMessage.ShellMessageType>(
        _msg: KernelMessage.IShellMessage<T>,
        _expectReply?: boolean,
        _disposeOnDone?: boolean
    ): Kernel.IShellFuture<KernelMessage.IShellMessage<T>> {
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
    public requestComplete(
        _content: KernelMessage.ICompleteRequestMsg['content']
    ): Promise<KernelMessage.ICompleteReplyMsg> {
        throw new Error('Not yet implemented');
    }
    public requestInspect(
        _content: KernelMessage.IInspectRequestMsg['content']
    ): Promise<KernelMessage.IInspectReplyMsg> {
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
    public sendInputReply(_content: KernelMessage.IInputReplyMsg['content']): void {
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
                if (message.header.session === this.sessionId && message.channel !== 'iopub') {
                    // RAWKERNEL: emit unhandled
                }
            }
        }

        // RAWKERNEL: Handle general IOpub messages
    }
}
