// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import * as uuid from 'uuid/v4';
import { IKernelProcess } from '../kernel-launcher/types';
import { IWebSocketLike } from '../kernelSocketWrapper';
import { IKernelSocket } from '../types';
import { RawSocket } from './rawSocket';
// tslint:disable-next-line: no-var-requires no-require-imports
const rewire = require('rewire') as typeof import('rewire');

// tslint:disable: no-any
/*
RawKernel class represents the mapping from the JupyterLab services IKernel interface
to a raw IPython kernel running on the local machine. RawKernel is in charge of taking
input request, translating them, sending them to an IPython kernel over ZMQ, then passing back the messages
*/
export class RawKernel implements Kernel.IKernel {
    public socket: IKernelSocket;
    public get terminated() {
        return this.realKernel.terminated as any;
    }
    public get statusChanged() {
        return this.realKernel.statusChanged as any;
    }
    public get iopubMessage() {
        return this.realKernel.iopubMessage as any;
    }
    public get unhandledMessage() {
        return this.realKernel.unhandledMessage as any;
    }
    public get anyMessage() {
        return this.realKernel.anyMessage as any;
    }
    public get serverSettings(): ServerConnection.ISettings {
        return this.realKernel.serverSettings;
    }
    public get id(): string {
        return this.realKernel.id;
    }
    public get name(): string {
        return this.realKernel.name;
    }
    public get model(): Kernel.IModel {
        return this.realKernel.model;
    }
    public get username(): string {
        return this.realKernel.username;
    }
    public get clientId(): string {
        return this.realKernel.clientId;
    }
    public get status(): Kernel.Status {
        return this.realKernel.status;
    }
    public get info(): KernelMessage.IInfoReply | null {
        return this.realKernel.info;
    }
    public get isReady(): boolean {
        return this.realKernel.isReady;
    }
    public get ready(): Promise<void> {
        return this.realKernel.ready;
    }
    public get handleComms(): boolean {
        return this.realKernel.handleComms;
    }
    public get isDisposed(): boolean {
        return this.realKernel.isDisposed;
    }
    constructor(private realKernel: Kernel.IKernel, socket: IKernelSocket & IWebSocketLike) {
        // Save this raw socket as our kernel socket. It will be
        // used to watch and respond to kernel messages.
        this.socket = socket;

        // Pretend like an open occurred. This will prime the real kernel to be connected
        socket.emit('open');
    }

    public shutdown(): Promise<void> {
        return this.realKernel.shutdown();
    }
    public getSpec(): Promise<Kernel.ISpecModel> {
        return this.realKernel.getSpec();
    }
    public sendShellMessage<T extends KernelMessage.ShellMessageType>(
        msg: KernelMessage.IShellMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<T>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        return this.realKernel.sendShellMessage(msg, expectReply, disposeOnDone);
    }
    public sendControlMessage<T extends KernelMessage.ControlMessageType>(
        msg: KernelMessage.IControlMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IControlFuture<
        KernelMessage.IControlMessage<T>,
        KernelMessage.IControlMessage<KernelMessage.ControlMessageType>
    > {
        return this.realKernel.sendControlMessage(msg, expectReply, disposeOnDone);
    }
    public reconnect(): Promise<void> {
        return this.realKernel.reconnect();
    }
    public interrupt(): Promise<void> {
        return this.realKernel.interrupt();
    }
    public restart(): Promise<void> {
        return this.realKernel.restart();
    }
    public requestKernelInfo(): Promise<KernelMessage.IInfoReplyMsg> {
        return this.realKernel.requestKernelInfo();
    }
    public requestComplete(content: { code: string; cursor_pos: number }): Promise<KernelMessage.ICompleteReplyMsg> {
        return this.realKernel.requestComplete(content);
    }
    public requestInspect(content: {
        code: string;
        cursor_pos: number;
        detail_level: 0 | 1;
    }): Promise<KernelMessage.IInspectReplyMsg> {
        return this.realKernel.requestInspect(content);
    }
    public requestHistory(
        content:
            | KernelMessage.IHistoryRequestRange
            | KernelMessage.IHistoryRequestSearch
            | KernelMessage.IHistoryRequestTail
    ): Promise<KernelMessage.IHistoryReplyMsg> {
        return this.realKernel.requestHistory(content);
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
        return this.realKernel.requestExecute(content, disposeOnDone, metadata);
    }
    public requestDebug(
        // tslint:disable-next-line: no-banned-terms
        content: { seq: number; type: 'request'; command: string; arguments?: any },
        disposeOnDone?: boolean
    ): Kernel.IControlFuture<KernelMessage.IDebugRequestMsg, KernelMessage.IDebugReplyMsg> {
        return this.realKernel.requestDebug(content, disposeOnDone);
    }
    public requestIsComplete(content: { code: string }): Promise<KernelMessage.IIsCompleteReplyMsg> {
        return this.realKernel.requestIsComplete(content);
    }
    public requestCommInfo(content: {
        target_name?: string;
        target?: string;
    }): Promise<KernelMessage.ICommInfoReplyMsg> {
        return this.realKernel.requestCommInfo(content);
    }
    public sendInputReply(content: KernelMessage.ReplyContent<KernelMessage.IInputReply>): void {
        return this.realKernel.sendInputReply(content);
    }
    public connectToComm(targetName: string, commId?: string): Kernel.IComm {
        return this.realKernel.connectToComm(targetName, commId);
    }
    public registerCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void {
        return this.realKernel.registerCommTarget(targetName, callback);
    }
    public removeCommTarget(
        targetName: string,
        callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ): void {
        return this.realKernel.removeCommTarget(targetName, callback);
    }
    public dispose(): void {
        return this.realKernel.dispose();
    }
    public registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        this.realKernel.registerMessageHook(msgId, hook);
    }
    public removeMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        this.realKernel.removeMessageHook(msgId, hook);
    }
}

let defaultImport: any;

export function createRawKernel(kernelProcess: IKernelProcess, clientId: string): RawKernel {
    // Dummy websocket we give to the underlying real kernel
    let socketInstance: any;
    class RawSocketWrapper extends RawSocket {
        constructor() {
            super(kernelProcess.connection);
            socketInstance = this;
        }
    }

    // Remap the server settings for the real kernel to use our dummy websocket
    // tslint:disable-next-line: no-require-imports
    const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');
    const settings = jupyterLab.ServerConnection.makeSettings({
        WebSocket: RawSocketWrapper as any,
        wsUrl: 'RAW'
    });

    // Then create the real kernel. We will remap its serialize/deserialize functions
    // to do nothing so that we can control serialization at our socket layer.
    // tslint:disable-next-line: no-require-imports
    if (!defaultImport) {
        defaultImport = rewire('@jupyterlab/services/lib/kernel/default');
        defaultImport.__set__('serialize.serialize', (a: any) => a);
        defaultImport.__set__('serialize.deserialize', (a: any) => a);
    }
    const realKernel = new defaultImport.DefaultKernel(
        {
            name: kernelProcess.kernelSpec.name,
            serverSettings: settings,
            clientId,
            handleComms: true
        },
        uuid()
    );

    // Use this real kernel in result.
    return new RawKernel(realKernel, socketInstance);
}
