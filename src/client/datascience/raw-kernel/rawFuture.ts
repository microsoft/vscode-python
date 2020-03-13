// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { JupyterMessage } from '@nteract/messaging';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { createDeferred, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';

// IANHU: Better name? Not happy with this, but want to get moving
/*
RawFuture represents the IFuture interface that JupyterLab services returns from functions like executeRequest.
It provides an interface for getting updates on the status of the request such as reply messages or io messages
https://github.com/jupyterlab/jupyterlab/blob/72d9e17dadbd8c9e9869c863949e44b57a80120d/packages/services/src/kernel/future.ts
*/
export class RawFuture<REQUEST extends KernelMessage.IShellControlMessage,
    REPLY extends KernelMessage.IShellControlMessage> implements Kernel.IFuture<REQUEST, REPLY> {

    private donePromise: Deferred<REPLY>;
    private stdIn: (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void> = noop;
    private ioPub: (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void> = noop;
    private reply: (msg: REPLY) => void | PromiseLike<void> = noop;

    public msg: REQUEST;

    constructor(msg: REQUEST) {
        this.msg = msg;
        this.donePromise = createDeferred<REPLY>();
    }

    get done(): Promise<REPLY | undefined> {
        return this.donePromise.promise;
    }

    // Message handlers that can be hooked up to for message notifications
    get onStdin(): (
        msg: KernelMessage.IStdinMessage
    ) => void | PromiseLike<void> {
        return this.stdIn;
    }

    set onStdin(
        handler: (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void>
    ) {
        this.stdIn = handler;
    }

    get onIOPub(): (
        msg: KernelMessage.IIOPubMessage
    ) => void | PromiseLike<void> {
        return this.ioPub;
    }

    set onIOPub(
        cb: (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void>
    ) {
        this.ioPub = cb;
    }
    get onReply(): (msg: REPLY) => void | PromiseLike<void> {
        return this.reply;
    }

    set onReply(handler: (msg: REPLY) => void | PromiseLike<void>) {
        this.reply = handler;
    }

    // Handle a new message passed from the kernel
    public async handleMessage(message: JupyterMessage): Promise<void> {
        console.log('test');
    }

    // IANHU: Not Implemented
    get isDisposed(): boolean {
        throw new Error('Not yet implemented');
    }

    public dispose(): void {
        throw new Error('Not yet implemented');
    }
    registerMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    removeMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    sendInputReply(_content: KernelMessage.IInputReplyMsg['content']): void {
        throw new Error('Not yet implemented');
    }
}