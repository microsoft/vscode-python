// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { DefaultKernel } from '@jupyterlab/services/lib/kernel/default';
import {
    IInteractiveWindowMapping,
    IPyWidgetMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { KernelSocketOptions } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';

// tslint:disable: no-any
export interface IKernelSocket {
    onMessage: ((ev: MessageEvent) => any) | null;
    postMessage(data: any): void;
}

// Proxy kernel that wraps the default kernel. We need this entire class because
// we can't derive from DefaultKernel.
class ProxyKernel implements IMessageHandler, Kernel.IKernel {
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
    private realKernel: Kernel.IKernel;
    private messageHooks = new Map<string, (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>>();
    private gotInitialKernelInfoRequest = false;
    constructor(options: Kernel.IOptions, id: string, private postOffice: PostOffice) {
        this.realKernel = new DefaultKernel(options, id);
        postOffice.addHandler(this);
    }
    public shutdown(): Promise<void> {
        return this.realKernel.shutdown();
    }
    public getSpec(): Promise<Kernel.ISpecModel> {
        return this.realKernel.getSpec();
    }
    public sendShellMessage<T extends KernelMessage.ShellMessageType>(
        msg: KernelMessage.IShellMessage<T>,
        expectReply?: boolean | undefined,
        disposeOnDone?: boolean | undefined
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<T>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        return this.realKernel.sendShellMessage(msg, expectReply, disposeOnDone);
    }
    public sendControlMessage<T extends KernelMessage.ControlMessageType>(
        msg: KernelMessage.IControlMessage<T>,
        expectReply?: boolean | undefined,
        disposeOnDone?: boolean | undefined
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
        // The first request has to be ignored. It comes from the socket opening
        if (!this.gotInitialKernelInfoRequest) {
            this.gotInitialKernelInfoRequest = true;
            return Promise.resolve() as any;
        }

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
            silent?: boolean | undefined;
            store_history?: boolean | undefined;
            user_expressions?: import('@phosphor/coreutils').JSONObject | undefined;
            allow_stdin?: boolean | undefined;
            stop_on_error?: boolean | undefined;
        },
        disposeOnDone?: boolean | undefined,
        metadata?: import('@phosphor/coreutils').JSONObject | undefined
    ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
        return this.realKernel.requestExecute(content, disposeOnDone, metadata);
    }
    public requestDebug(
        // tslint:disable-next-line: no-banned-terms
        content: { seq: number; type: 'request'; command: string; arguments?: any },
        disposeOnDone?: boolean | undefined
    ): Kernel.IControlFuture<KernelMessage.IDebugRequestMsg, KernelMessage.IDebugReplyMsg> {
        return this.realKernel.requestDebug(content, disposeOnDone);
    }
    public requestIsComplete(content: { code: string }): Promise<KernelMessage.IIsCompleteReplyMsg> {
        return this.realKernel.requestIsComplete(content);
    }
    public requestCommInfo(content: {
        target_name?: string | undefined;
        target?: string | undefined;
    }): Promise<KernelMessage.ICommInfoReplyMsg> {
        return this.realKernel.requestCommInfo(content);
    }
    public sendInputReply(content: KernelMessage.ReplyContent<KernelMessage.IInputReply>): void {
        return this.realKernel.sendInputReply(content);
    }
    public connectToComm(targetName: string, commId?: string | undefined): Kernel.IComm {
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
    public handleMessage(type: string, payload?: any): boolean {
        if (type === IPyWidgetMessages.IPyWidgets_MessageHookCall) {
            this.handleMessageHookCall(payload);
            return true;
        }
        return false;
    }
    public registerMessageHook(
        msgId: string,
        hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        this.messageHooks.set(msgId, hook);

        // Tell the other side about this.
        this.postOffice.sendMessage<IInteractiveWindowMapping>(IPyWidgetMessages.IPyWidgets_RegisterMessageHook, msgId);

        // However also register our own hook on this side. We need to wait
    }
    public removeMessageHook(
        msgId: string,
        _hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        this.messageHooks.delete(msgId);
        this.postOffice.sendMessage<IInteractiveWindowMapping>(IPyWidgetMessages.IPyWidgets_RemoveMessageHook, msgId);
    }

    private handleMessageHookCall(args: { requestId: string; parentId: string; msg: KernelMessage.IIOPubMessage }) {
        // tslint:disable-next-line: no-any
        window.console.log(`Message hook callback for ${(args.msg as any).msg_type} and ${args.parentId}`);
        // tslint:disable-next-line: no-any
        const hook = this.messageHooks.get((args.msg.parent_header as any).msg_id);
        if (hook) {
            const result = hook(args.msg);
            // tslint:disable-next-line: no-any
            if ((result as any).then) {
                // tslint:disable-next-line: no-any
                (result as any).then((r: boolean) => {
                    this.postOffice.sendMessage<IInteractiveWindowMapping>(
                        IPyWidgetMessages.IPyWidgets_MessageHookResponse,
                        {
                            requestId: args.requestId,
                            parentId: args.parentId,
                            msgType: args.msg.header.msg_type,
                            result: r
                        }
                    );
                });
            } else {
                this.postOffice.sendMessage<IInteractiveWindowMapping>(
                    IPyWidgetMessages.IPyWidgets_MessageHookResponse,
                    {
                        requestId: args.requestId,
                        parentId: args.parentId,
                        msgType: args.msg.header.msg_type,
                        result: result === true
                    }
                );
            }
        } else {
            // If no hook registered, make sure not to remove messages.
            this.postOffice.sendMessage<IInteractiveWindowMapping>(IPyWidgetMessages.IPyWidgets_MessageHookResponse, {
                requestId: args.requestId,
                parentId: args.parentId,
                msgType: args.msg.header.msg_type,
                result: true
            });
        }
    }
}

/**
 * Creates a kernel from a websocket.
 * Check code in `node_modules/@jupyterlab/services/lib/kernel/default.js`.
 * The `_createSocket` method basically connects to a websocket and listens to messages.
 * Hence to create a kernel, all we need is a socket connection (class with onMessage and postMessage methods).
 */
export function create(socket: IKernelSocket, options: KernelSocketOptions, postOffice: PostOffice) {
    let proxySocketInstance: ProxyWebSocket | undefined;
    class ProxyWebSocket {
        public onopen?: ((this: ProxyWebSocket) => any) | null;
        public onmessage?: ((this: ProxyWebSocket, ev: MessageEvent) => any) | null;
        constructor() {
            proxySocketInstance = this;
            socket.onMessage = (msg) => {
                // Today jupyter labs uses `onmessage` instead of `on/addListener/addEventListener`.
                // We can if required use `EventEmitter` to make it bullet proof.
                if (this.onmessage) {
                    this.onmessage(msg);
                }
            };
        }
        public close(_code?: number | undefined, _reason?: string | undefined): void {
            // Nothing.
        }
        public send(data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView): void {
            socket.postMessage(data);
        }
    }

    // tslint:disable-next-line: no-any
    const settings = ServerConnection.makeSettings({ WebSocket: ProxyWebSocket as any, wsUrl: 'BOGUS_PVSC' });
    // This is crucial, the clientId must match the real kernel in extension.
    // All messages contain the clientId as `session` in the request.
    // If this doesn't match the actual value, then things can and will go wrong.
    const kernel = new ProxyKernel(
        {
            name: options.model.name,
            serverSettings: settings,
            clientId: options.clientId,
            handleComms: true,
            username: options.userName
        },
        options.id,
        postOffice
    );

    // This is kind of the hand shake.
    // As soon as websocket opens up, the kernel sends a request to check if it is alive.
    // If it gets a response, then it is deemed ready.
    if (proxySocketInstance?.onopen) {
        proxySocketInstance.onopen();
    }

    return kernel;
}
