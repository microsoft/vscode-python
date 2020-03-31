// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License.

// 'use strict';

// import { Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
// import { DefaultKernel } from '@jupyterlab/services/lib/kernel/default';
// import { KernelSocketOptions } from '../../client/datascience/types';
// // import type { Data as WebSocketData } from 'ws';

// // tslint:disable: no-any
// export interface IKernelSocket {
//     onMessage: ((ev: MessageEvent) => any) | null;
//     // on(event: 'message', listener: (this: WebSocket, data: WebSocketData) => void): this;
//     // send(data: any, cb?: (err?: Error) => void): void;
//     // tslint:disable-next-line: no-any
//     postMessage(data: any): void;
// }
// export function create(socket: IKernelSocket, options: KernelSocketOptions) {
//     let proxySocketInstance: ProxyWebSocket | undefined;
//     debugger;
//     class ProxyWebSocket {
//         public onopen?: ((this: ProxyWebSocket) => any) | null;
//         public onmessage?: ((this: ProxyWebSocket, ev: MessageEvent) => any) | null;
//         constructor() {
//             proxySocketInstance = this;
//             socket.onMessage = (msg) => {
//                 if (this.onmessage) {
//                     this.onmessage({ data: msg } as any);
//                 }
//             };
//         }
//         public close(_code?: number | undefined, _reason?: string | undefined): void {}
//         public send(data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView): void {
//             socket.postMessage(data);
//         }
//     }

//     // tslint:disable-next-line: no-any
//     const settings = ServerConnection.makeSettings({ WebSocket: ProxyWebSocket as any, wsUrl: 'BOGUS_PVSC' });
//     // const kernel = Kernel.connectTo({ name: 'pvsc', id: 'pvsc' }, settings);
//     const kernel = new DefaultKernel(
//         {
//             name: options.model.name,
//             serverSettings: settings,
//             clientId: options.clientId,
//             handleComms: true,
//             username: options.userName
//         },
//         options.model.id
//     );
//     // const kernel = new DefaultKernel(
//     //     {
//     //         name: 'python37764bitdsamlconda070b8415718b47ba80641c56459d78f1',
//     //         serverSettings: settings,
//     //         clientId: 'fda3f9d9-c9f4-4f71-ae10-3dd8e7a38893',
//     //         handleComms: true,
//     //         username: 'donjayamanne'
//     //     },
//     //     '023b8d46-156f-4fbf-b7da-d2eb2a4325d3'
//     // );
//     // (kernel as any)._clientId = 'fda3f9d9-c9f4-4f71-ae10-3dd8e7a38893';

//     const originalRegisterCommTarget = kernel.registerCommTarget.bind(kernel);
//     const originalRequestKernelInfo = kernel.requestKernelInfo.bind(kernel);
//     kernel.requestKernelInfo = () => {
//         kernel.requestKernelInfo = originalRequestKernelInfo;
//         return Promise.resolve() as any;
//     };
//     kernel.registerCommTarget = (
//         targetName: string,
//         callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
//     ) => {
//         console.error('Hello');
//         socket.postMessage({ targetName });
//         return originalRegisterCommTarget(targetName, callback);
//     };

//     if (proxySocketInstance?.onopen) {
//         proxySocketInstance.onopen();
//     }
//     // socket.onMessage = msg => {
//     //     (kernel as any)._onWSMessage2(msg);
//     // };

//     return kernel;
// }
