// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { createDeferred, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';

/*
RawFuture represents the IFuture interface that JupyterLab services returns from functions like executeRequest.
It provides an interface for getting updates on the status of the request such as reply messages or io messages
*/
export class RawFuture<
    REQUEST extends KernelMessage.IShellControlMessage,
    REPLY extends KernelMessage.IShellControlMessage
> implements Kernel.IFuture<REQUEST, REPLY> {
    public isDisposed: boolean = false;
    public msg: REQUEST;

    private donePromise: Deferred<REPLY>;
    private stdIn: (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void> = noop;
    private ioPub: (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void> = noop;
    private reply: (msg: REPLY) => void | PromiseLike<void> = noop;
    private replyMessage: REPLY | undefined;
    private disposeOnDone: boolean;
    private idleSeen: boolean = false;
    private replySeen: boolean = false;

    constructor(msg: REQUEST, expectReply: boolean, disposeOnDone: boolean) {
        this.msg = msg;
        this.donePromise = createDeferred<REPLY>();
        this.disposeOnDone = disposeOnDone;

        // If we don't expect a reply then indicate that we've already seen one
        // for done checks
        if (!expectReply) {
            this.replySeen = true;
        }
    }

    get done(): Promise<REPLY | undefined> {
        return this.donePromise.promise;
    }

    // Message handlers that can be hooked up to for message notifications
    get onStdin(): (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void> {
        return this.stdIn;
    }

    set onStdin(handler: (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void>) {
        this.stdIn = handler;
    }

    get onIOPub(): (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void> {
        return this.ioPub;
    }

    set onIOPub(cb: (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void>) {
        this.ioPub = cb;
    }
    get onReply(): (msg: REPLY) => void | PromiseLike<void> {
        return this.reply;
    }

    set onReply(handler: (msg: REPLY) => void | PromiseLike<void>) {
        this.reply = handler;
    }

    // Handle a new message passed from the kernel
    public async handleMessage(message: KernelMessage.IMessage<KernelMessage.MessageType>): Promise<void> {
        switch (message.channel) {
            case 'stdin':
                await this.handleStdIn(message as KernelMessage.IStdinMessage);
                break;
            case 'iopub':
                await this.handleIOPub(message as KernelMessage.IIOPubMessage);
                break;
            case 'control':
            case 'shell':
                await this.handleShellControl(message as KernelMessage.IShellControlMessage);
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
            this.donePromise.reject(new Error('Disposed Future'));
            this.isDisposed = true;
        }
    }

    // RAWKERNEL: Not Implemented
    public registerMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    public removeMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        throw new Error('Not yet implemented');
    }
    public sendInputReply(_content: KernelMessage.IInputReplyMsg['content']): void {
        throw new Error('Not yet implemented');
    }

    // Private Functions

    // Functions for handling specific message types
    private async handleStdIn(message: KernelMessage.IStdinMessage): Promise<void> {
        // Call our handler for stdin, might just be noop
        // RAWKERNEL: same channel type string != 'stdin' cast issue
        // tslint:disable-next-line:no-any
        await this.stdIn(message);
    }

    private async handleIOPub(message: KernelMessage.IIOPubMessage): Promise<void> {
        // tslint:disable-next-line:no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

        // RAWKERNEL: Check hooks process first?
        // tslint:disable-next-line:no-any
        await this.ioPub(message);

        // If we get an idle status message and a reply then we are done
        if (jupyterLab.KernelMessage.isStatusMsg(message) && message.content.execution_state === 'idle') {
            this.idleSeen = true;

            if (this.replySeen) {
                this.handleDone();
            }
        }
    }

    private async handleShellControl(message: KernelMessage.IShellControlMessage): Promise<void> {
        if (message.channel === this.msg.channel && message.parent_header) {
            const parentHeader = message.parent_header as KernelMessage.IHeader;
            if (parentHeader.msg_id === this.msg.header.msg_id) {
                await this.handleReply(message as REPLY);
            }
        }
    }

    private async handleReply(message: REPLY): Promise<void> {
        await this.reply(message);

        this.replyMessage = message;
        this.replySeen = true;

        // If we've gotten an idle status message we are done now
        if (this.idleSeen) {
            this.handleDone();
        }
    }

    private handleDone(): void {
        this.donePromise.resolve(this.replyMessage);

        if (this.disposeOnDone) {
            this.dispose();
        }
    }
}
