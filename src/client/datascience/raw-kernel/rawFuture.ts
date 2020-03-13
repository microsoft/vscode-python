// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Kernel, KernelMessage } from '@jupyterlab/services';

// IANHU: Better name? Not happy with this, but want to get moving
/*
RawFuture represents the IFuture interface that JupyterLab services returns from functions like executeRequest.
It provides an interface for getting updates on the status of the request such as reply messages or io messages
https://github.com/jupyterlab/jupyterlab/blob/72d9e17dadbd8c9e9869c863949e44b57a80120d/packages/services/src/kernel/future.ts
*/
export class RawFuture<REQUEST extends KernelMessage.IShellControlMessage,
    REPLY extends KernelMessage.IShellControlMessage> implements Kernel.IFuture<REQUEST, REPLY> {

    // IANHU: Not Implemented
    get isDisposed(): boolean {
        throw new Error('Not yet implemented');
    }

    public dispose(): void {
        throw new Error('Not yet implemented');
    }
    get msg(): REQUEST {
        throw new Error('Not yet implemented');
    }
    get done(): Promise<REPLY | undefined> {
        throw new Error('Not yet implemented');
    }
    onReply(_msg: REPLY): void | PromiseLike<void> {
        throw new Error('Not yet implemented');
    }
    onIOPub(_msg: KernelMessage.IIOPubMessage): void | PromiseLike<void> {
        throw new Error('Not yet implemented');
    }
    onStdin(_msg: KernelMessage.IStdinMessage): void | PromiseLike<void> {
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