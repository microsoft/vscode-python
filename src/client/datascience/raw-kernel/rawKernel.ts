// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils';
import { ISignal } from '@phosphor/signaling';

// IANHU: Better name? Not happy with this, but want to get moving
/*
RawKernel class represents the mapping from the JupyterLab services IKernel interface
to a raw IPython kernel running on the local machine. RawKernel is in charge of taking
input request, translating them, sending them to an IPython kernel over ZMQ, then passing back the messages
*/
export class RawKernel implements Kernel.IKernel {
    constructor() { }

    // IANHU: Implemented

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
    requestExecute(_content: KernelMessage.IExecuteRequestMsg['content'], _disposeOnDone?: boolean, _metadata?: JSONObject): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
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
}