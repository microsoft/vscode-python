// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel, KernelMessage } from '@jupyterlab/services';
import { Deferred } from '../../client/common/utils/async';
import { IPyWidgetMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';

export class ClassicCommShellCallbackManager {
    private requestFutureMap = new Map<
        string,
        { future: Kernel.IShellFuture; deferred: Deferred<KernelMessage.IShellMessage | undefined> }
    >();
    public registerFuture(
        requestId: string,
        future: Kernel.IShellFuture,
        deferred: Deferred<KernelMessage.IShellMessage | undefined>
    ) {
        this.requestFutureMap.set(requestId, { future, deferred });
    }
    public unregisterFuture(requestId: string) {
        this.requestFutureMap.delete(requestId);
    }
    // tslint:disable-next-line: no-any
    public async handleShellCallbacks(msg: string, payload?: any): Promise<void> {
        switch (msg) {
            case IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub: {
                // We got an `iopub` message on the comm for the `shell_` message that was sent by ipywidgets.
                // The `shell` message was sent using our custom `IComm` component provided to ipywidgets.
                // ipywidgets uses the `IComm.send` method.
                const requestId = payload.requestId;
                const reply = this.requestFutureMap.get(requestId)!;
                reply.future.onIOPub(payload.msg);
                break;
            }
            case IPyWidgetMessages.IPyWidgets_ShellSend_reply: {
                // We got a `reply` message on the comm for the `shell_` message that was sent by ipywidgets.
                // The `shell` message was sent using our custom `IComm` component provided to ipywidgets.
                // ipywidgets uses the `IComm.send` method.
                const requestId = payload.requestId;
                const reply = this.requestFutureMap.get(requestId)!;
                reply.future.onReply(payload.msg);
                break;
            }
            case IPyWidgetMessages.IPyWidgets_ShellSend_resolve: {
                // We got a `reply` message on the comm for the `shell_` message that was sent by ipywidgets.
                // The `shell` message was sent using our custom `IComm` component provided to ipywidgets.
                // ipywidgets uses the `IComm.send` method.
                const requestId = payload.requestId;
                const reply = this.requestFutureMap.get(requestId)!;
                this.unregisterFuture(requestId);
                reply.deferred.resolve(payload.msg);
                break;
            }
            case IPyWidgetMessages.IPyWidgets_ShellSend_reject: {
                // We got a `reply` message on the comm for the `shell_` message that was sent by ipywidgets.
                // The `shell` message was sent using our custom `IComm` component provided to ipywidgets.
                // ipywidgets uses the `IComm.send` method.
                const requestId = payload.requestId;
                const reply = this.requestFutureMap.get(requestId)!;
                this.unregisterFuture(requestId);
                reply.deferred.reject(payload.msg);
                break;
            }
            default:
                break;
        }
    }
}
