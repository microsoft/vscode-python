// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import * as uuid from 'uuid/v4';
import { createDeferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { serializeDataViews } from '../../client/common/utils/serializers';
import { IPyWidgetMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { ClassicCommShellCallbackManager } from './callbackManager';
import { IMessageSender } from './types';

export class ClassicComm implements Kernel.IComm {
    public isDisposed: boolean = false;
    public onClose: (msg: KernelMessage.ICommCloseMsg) => void | PromiseLike<void> = noop;
    public onMsg: (msg: KernelMessage.ICommMsgMsg) => void | PromiseLike<void> = noop;
    private readonly registeredFutures: string[] = [];
    constructor(
        public readonly commId: string,
        public readonly targetName: string,
        private readonly messageSender: IMessageSender,
        private readonly callbackManager: ClassicCommShellCallbackManager
    ) {}
    // tslint:disable-next-line: no-any
    public open(data?: any, metadata?: any, buffers?: (ArrayBuffer | ArrayBufferView)[] | undefined): Kernel.IShellFuture {
        // tslint:disable-next-line: no-console
        const requestId = uuid();
        const commId: string = this.commId;
        const deferred = createDeferred<KernelMessage.IShellMessage | undefined>();
        // Create a dummy response (IFuture) that we'll send to ipywidgets controls.
        // Dummy because the actual IFuture object will be on the extension side.
        // tslint:disable-next-line: no-any
        const shellMessage = ({ header: { msg_id: requestId } } as any) as KernelMessage.IShellMessage;
        const reply: Partial<Kernel.IShellFuture> = {
            onIOPub: noop,
            onReply: noop,
            onStdin: noop,
            done: deferred.promise,
            msg: shellMessage
        };
        // tslint:disable-next-line: no-any
        const future = (reply as any) as Kernel.IShellFuture;
        // Keep track of the future.
        // When messages arrive from extension we can resolve this future.
        this.registeredFutures.push(requestId);
        this.callbackManager.registerFuture(requestId, future, deferred);
        const targetName = this.targetName;
        const msgType = 'comm_open';
        // Send this payload to the extension where we'll use the real comms to send to the kernel.
        // The response will be handled and sent back as messages to the UI as messages `shellSend_*`
        this.messageSender.sendMessage(IPyWidgetMessages.IPyWidgets_ShellSend, {
            data,
            metadata,
            commId,
            requestId,
            buffers: serializeDataViews(buffers),
            targetName,
            msgType
        });

        // ipywidgets will use this as a promise (ifuture).
        return future;
    }
    // tslint:disable-next-line: no-any
    public close(_data?: any, _metadata?: any, _buffers?: (ArrayBuffer | ArrayBufferView)[] | undefined): Kernel.IShellFuture {
        this.registeredFutures.forEach(item => this.callbackManager.unregisterFuture(item));
        throw new Error('VSCPython.IClassicComm.Close method not implemented!');
    }
    public dispose(): void {
        this.registeredFutures.forEach(item => this.callbackManager.unregisterFuture(item));
    }
    // tslint:disable-next-line: no-any
    public send(data: any, metadata?: any, buffers?: (ArrayBuffer | ArrayBufferView)[] | undefined, disposeOnDone?: boolean | undefined): Kernel.IShellFuture {
        // tslint:disable-next-line: no-console
        const requestId = uuid();
        const commId: string = this.commId;
        const deferred = createDeferred<KernelMessage.IShellMessage | undefined>();
        // Create a dummy response (IFuture) that we'll send to ipywidgets controls.
        // Dummy because the actual IFuture object will be on the extension side.
        // tslint:disable-next-line: no-any
        const shellMessage = ({ header: { msg_id: requestId } } as any) as KernelMessage.IShellMessage;
        const reply: Partial<Kernel.IShellFuture> = {
            onIOPub: noop,
            onReply: noop,
            onStdin: noop,
            done: deferred.promise,
            msg: shellMessage
        };
        // tslint:disable-next-line: no-any
        const future = (reply as any) as Kernel.IShellFuture;
        // Keep track of the future.
        // When messages arrive from extension we can resolve this future.
        this.registeredFutures.push(requestId);
        this.callbackManager.registerFuture(requestId, future, deferred);
        // const targetName = this.targetName;
        const targetName = undefined;
        const msgType = 'comm_msg';
        // Send this payload to the extension where we'll use the real comms to send to the kernel.
        // The response will be handled and sent back as messages to the UI as messages `shellSend_*`
        this.messageSender.sendMessage(IPyWidgetMessages.IPyWidgets_ShellSend, {
            data,
            metadata,
            commId,
            requestId,
            disposeOnDone,
            buffers: serializeDataViews(buffers),
            targetName,
            msgType
        });

        // ipywidgets will use this as a promise (ifuture).
        return future;
    }
}
