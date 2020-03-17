// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import { createDeferred } from './async';
import { KernelProxyInterface } from './proxy';
import { KernelConnectionInformation } from './types';

export class KernelConnection implements Kernel.IKernelConnection {
    public get id(): string {
        return this.connectionInfo.id;
    }
    public get name(): string {
        return this.connectionInfo.name;
    }
    public get model(): Kernel.IModel {
        return this.connectionInfo.model;
    }
    public get username(): string {
        return this.connectionInfo.username;
    }
    public get clientId(): string {
        return this.connectionInfo.clientId;
    }
    public get status(): Kernel.Status {
        return this.connectionInfo.status;
    }
    public get info(): KernelMessage.IInfoReply {
        return this.connectionInfo.info;
    }
    public get isReady(): boolean {
        return this._isReady;
    }
    public get ready(): Promise<void> {
        return this._ready.promise;
    }
    public get handleComms(): boolean {
        return this.connectionInfo.handleComms;
    }
    public get isDisposed(): boolean {
        return this._disposed;
    }

    private readonly _isReady: boolean = false;
    private readonly _ready = createDeferred<void>();
    private readonly _disposed: boolean = false;
    constructor(
        private readonly connectionInfo: KernelConnectionInformation,
        private readonly proxy: KernelProxyInterface
    ) {}
    public getSpec(): Promise<Kernel.ISpecModel> {
        return this.proxy.getSpec();
    }
    public sendShellMessage<T extends KernelMessage.ShellMessageType>(
        msg: KernelMessage.IShellMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<T>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        return this.proxy.sendShellMessage(msg, expectReply, disposeOnDone);
    }
    public sendControlMessage<T extends KernelMessage.ControlMessageType>(
        msg: KernelMessage.IControlMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IControlFuture<
        KernelMessage.IControlMessage<T>,
        KernelMessage.IControlMessage<KernelMessage.ControlMessageType>
    > {
        throw new Error('Method not implemented.');
    }
    public reconnect(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public interrupt(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public restart(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    public requestKernelInfo(): Promise<KernelMessage.IInfoReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestComplete(content: { code: string; cursor_pos: number }): Promise<KernelMessage.ICompleteReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestInspect(content: {
        code: string;
        cursor_pos: number;
        detail_level: 0 | 1;
    }): Promise<KernelMessage.IInspectReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestHistory(
        content:
            | KernelMessage.IHistoryRequestRange
            | KernelMessage.IHistoryRequestSearch
            | KernelMessage.IHistoryRequestTail
    ): Promise<KernelMessage.IHistoryReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestExecute(
        content: {
            code: string;
            silent?: boolean;
            store_history?: boolean;
            user_expressions?: import('@phosphor/coreutils').JSONObject;
            allow_stdin?: boolean;
            stop_on_error?: boolean;
        },
        disposeOnDone?: boolean,
        metadata?: import('@phosphor/coreutils').JSONObject
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestDebug(
        content: { seq: number; type: 'request'; command: string; arguments?: any },
        disposeOnDone?: boolean
    ): Kernel.IControlFuture<KernelMessage.IDebugRequestMsg, KernelMessage.IDebugReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestIsComplete(content: { code: string }): Promise<KernelMessage.IIsCompleteReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public requestCommInfo(content: {
        target_name?: string;
        target?: string;
    }): Promise<KernelMessage.ICommInfoReplyMsg> {
        throw new Error('Method not implemented.');
    }
    public sendInputReply(content: KernelMessage.ReplyContent<KernelMessage.IInputReply>): void {
        throw new Error('Method not implemented.');
    }
    public connectToComm(targetName: string, commId?: string): Kernel.IComm {
        throw new Error('Method not implemented.');
    }
    public registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void {
        throw new Error('Method not implemented.');
    }
    public removeCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void {
        throw new Error('Method not implemented.');
    }
    public registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage<KernelMessage.IOPubMessageType>) => boolean | PromiseLike<boolean>
    ): void {
        throw new Error('Method not implemented.');
    }
    public removeMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage<KernelMessage.IOPubMessageType>) => boolean | PromiseLike<boolean>
    ): void {
        throw new Error('Method not implemented.');
    }
    public dispose(): void {
        throw new Error('Method not implemented.');
    }
}
