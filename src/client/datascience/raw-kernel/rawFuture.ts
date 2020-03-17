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
    private replyMessage: REPLY | undefined;
    private disposeOnDone: boolean;

    public isDisposed: boolean = false;
    public msg: REQUEST;

    constructor(msg: REQUEST, disposeOnDone: boolean) {
        this.msg = msg;
        this.donePromise = createDeferred<REPLY>();
        this.disposeOnDone = disposeOnDone;
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
        switch (message.channel) {
            case 'stdin':
                await this.handleStdIn(message);
                break;
            case 'iopub':
                await this.handleIOPub(message);
                break;
            case 'control':
            case 'shell':
                await this.handleShellControl(message);
                break;
            default:
                break;
        }
    }

    public dispose(): void {
        if (!this.isDisposed) {
            // First clear out our handlers
            this.stdIn = noop;
            this.ioPub = noop;
            this.reply = noop;

            // Reject our done promise
            this.donePromise.reject(new Error('Disposed rawFuture'));
            this.isDisposed = true;
        }
    }

    // IANHU: Not Implemented
    registerMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    removeMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    sendInputReply(_content: KernelMessage.IInputReplyMsg['content']): void {
        throw new Error('Not yet implemented');
    }

    // Private Functions

    // Functions for handling specific message types
    private async handleStdIn(message: JupyterMessage): Promise<void> {
        // Call our handler for stdin, might just be noop
        // IANHU: same channel type string != 'stdin' cast issue
        await this.stdIn(message as any);
    }

    private async handleIOPub(message: JupyterMessage): Promise<void> {
        // IANHU: Check hooks process first?
        await this.ioPub(message as any);

        // If we get an idle status message then we are done
        if (message.header.msg_type === 'status' && message.content.execution_state === 'idle') {
            this.handleDone();
        }
    }

    private async handleShellControl(message: JupyterMessage): Promise<void> {
        if (message.channel === this.msg.channel &&
            message.parent_header.msg_id === this.msg.header.msg_id) {
            await this.handleReply(message as REPLY);
        }
    }

    private async handleReply(message: REPLY): Promise<void> {
        await this.reply(message);

        this.replyMessage = message;

        this.handleDone();
    }

    private handleDone(): void {
        this.donePromise.resolve(this.replyMessage);

        if (this.disposeOnDone) {
            this.dispose();
        }
    }
}