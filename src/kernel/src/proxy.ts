// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';

export interface KernelProxyInterface {
    getSpec(): Promise<Kernel.ISpecModel>;
    sendShellMessage<T extends KernelMessage.ShellMessageType>(
        msg: KernelMessage.IShellMessage<T>,
        expectReply?: boolean,
        disposeOnDone?: boolean
    ): Kernel.IShellFuture<KernelMessage.IShellMessage<T>, KernelMessage.IShellMessage<KernelMessage.ShellMessageType>>;
}


export class KernelProxyClient implements KernelProxyInterface {
    getSpec(): Promise<Kernel.ISpecModel> {
        throw new Error('Method not implemented.');
    }
    sendShellMessage<T extends KernelMessage.ShellMessageType>(msg: KernelMessage.IShellMessage<T>, expectReply?: boolean, disposeOnDone?: boolean): Kernel.IShellFuture<KernelMessage.IShellMessage<T>, KernelMessage.IShellMessage<KernelMessage.ShellMessageType>> {
        throw new Error('Method not implemented.');
    }

}

export class KernelProxyServer implements KernelProxyInterface {
    getSpec(): Promise<Kernel.ISpecModel> {
        throw new Error('Method not implemented.');
    }
    sendShellMessage<T extends KernelMessage.ShellMessageType>(msg: KernelMessage.IShellMessage<T>, expectReply?: boolean, disposeOnDone?: boolean): Kernel.IShellFuture<KernelMessage.IShellMessage<T>, KernelMessage.IShellMessage<KernelMessage.ShellMessageType>> {
        throw new Error('Method not implemented.');
    }

}
