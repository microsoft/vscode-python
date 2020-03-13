// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { Channels, executeRequest, JupyterMessage, message, MessageType } from '@nteract/messaging';
import { JSONObject } from '@phosphor/coreutils';
import { ISignal } from '@phosphor/signaling';
import { createMainChannel, JupyterConnectionInfo, createSockets } from 'enchannel-zmq-backend';
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

    constructor() {
    }

    public async connect(connectInfo: JupyterConnectionInfo) {
        // IANHU: Also option for creating individual sockets
        if (!this.mainChannel) {
            this.sessionId = uuid();
            this.mainChannel = await createMainChannel(connectInfo, undefined, this.sessionId);
            this.mainChannel.subscribe(msg => { this.msgIn(msg) });
        }

        // IANHU: Clean up initialization
        //const { shell, control, stdin, iopub } = await createSockets(connectInfo);
        //this.shellSocket = shell;
        //this.controlSocket = control;
        //this.stdinSocket = stdin;
        //this.iopubSocket = iopub;
    }

    // IANHU: Implemented
    public requestExecute(_content: KernelMessage.IExecuteRequestMsg['content'], _disposeOnDone?: boolean, _metadata?: JSONObject): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
        // First off we have to translate this message into the desired form
        // IShellFuture is basically just a request and reply IShellMessage

        // Here is what is in _content
        //Object {code: "%config InlineBackend.figure_formats = {'svg', 'pn…", stop_on_error: false, allow_stdin: true, store_history: false}
        //allow_stdin:true
        //code:"%config InlineBackend.figure_formats = {'svg', 'png'}"
        //stop_on_error:false
        //store_history:false

        // Let's see what the shape that we pass into enchannel is
        //var message = {
        //header: {
        //msg_id: `execute_9ed11a0f-707e-4f71-829c-a19b8ff8eed8`,
        //username: 'rgbkrk',
        //session: '00000000-0000-0000-0000-000000000000',
        //msg_type: 'execute_request',
        //version: '5.0',
        //},
        //content: {
        //code: 'print("woo")',
        //silent: false,
        //store_history: true,
        //user_expressions: {},
        //allow_stdin: false,
        //},
        //};

        if (this.mainChannel) {
            //const body = {
            //header: {
            //msg_id: `execute_9ed11a0f-707e-4f71-829c-a19b8ff8eed8`,
            //username: "rgbkrk",
            //session: "00000000-0000-0000-0000-000000000000",
            //msg_type: "execute_request",
            //version: "5.0"
            //},
            //content: {
            //code: 'print("hello")',
            //silent: false,
            //store_history: true,
            //user_expressions: {},
            //allow_stdin: false
            //}
            //};
            //const message = { type: "shell", body };

            const fakeExecute = this.buildJupyterMessage();

            this.mainChannel.next(fakeExecute);

            ///IANHU: Now how does this translate to an IShellFuture?
            // IFuture is a pretty simple interface, am I creating my own? Should check first if enchannel is 
            // doing something like this already? Doesn't look like they are, which makes sense as they have
            // cut out the Jupyter top layer more directly

            // I think at this point we need to keep tabs on our our IFutures then we need to route messages to them 
            // as needed as new messages come in
        }

        return new RawFuture();
        //throw new Error('Not yet implemented');
    }

    // IANHU: Don't Implement
    // IANHU: Dispose
    get isDisposed(): boolean {
        throw new Error('Not yet implemented');
    }

    public dispose(): void {
        throw new Error('Not yet implemented');
    }

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
    private buildJupyterMessage(): JupyterMessage {
        //header: { msg_type: MT; username?: string; session?: string },
        //content: object = {}k

        // IANHU: username? nteract just default to nteract
        //const header = { msg_type: "execute_request", session: this.sessionId };
        //const content = {};

        //return message<'execute_request'>(header, content);
        return executeRequest('print("hello")');
    }

    // Just our quick message watcher for now
    private msgIn(jm: JupyterMessage): void {
        console.log(jm);
    }
}