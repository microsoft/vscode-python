// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ServerConnection } from '@jupyterlab/services';
import { DefaultKernel } from '@jupyterlab/services/lib/kernel/default';
import { KernelSocketOptions } from '../../client/datascience/types';
// import type { Data as WebSocketData } from 'ws';

// tslint:disable: no-any
export interface IKernelSocket {
    onMessage: ((ev: MessageEvent) => any) | null;
    postMessage(data: any): void;
}
/**
 * Creates a kernel from a websocket.
 * Check code in `node_modules/@jupyterlab/services/lib/kernel/default.js`.
 * The `_createSocket` method basically connects to a websocket and listens to messages.
 * Hence to create a kernel, all we need is a socket connection (class with onMessage and postMessage methods).
 */
export function create(socket: IKernelSocket, options: KernelSocketOptions) {
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
                    this.onmessage({ data: msg } as any);
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
    const kernel = new DefaultKernel(
        {
            name: options.model.name,
            serverSettings: settings,
            clientId: options.clientId,
            handleComms: true,
            username: options.userName
        },
        options.id
    );

    // This is kind of the hand shake.
    // As soon as websocket opens up, the kernel sends a request to check if it is alive.
    // If it gets a response, then it is deemed ready.
    // This can optionally be disabled.
    const originalRequestKernelInfo = kernel.requestKernelInfo.bind(kernel);
    kernel.requestKernelInfo = () => {
        kernel.requestKernelInfo = originalRequestKernelInfo;
        return Promise.resolve() as any;
    };

    // // When a comm target has been regisered, we need to register this in the real kernel in extension side.
    // // Hence send that message to extension.
    // const originalRegisterCommTarget = kernel.registerCommTarget.bind(kernel);
    // kernel.registerCommTarget = (
    //     targetName: string,
    //     callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    // ) => {
    //     console.error('Hello');
    //     // socket.postMessage({ targetName });
    //     commtargetRegistered(targetName);
    //     return originalRegisterCommTarget(targetName, callback);
    // };

    if (proxySocketInstance?.onopen) {
        proxySocketInstance.onopen();
    }
    kernel.requestKernelInfo = originalRequestKernelInfo;

    return kernel;
}
