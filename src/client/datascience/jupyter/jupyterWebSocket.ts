// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';
import { traceError } from '../../common/logger';
import { IKernelSocket } from '../types';

// tslint:disable: no-any
export const JupyterWebSockets = new Map<string, WebSocketWS & IKernelSocket>();

// We need to override the websocket that jupyter lab services uses to put in our cookie information
// Do this as a function so that we can pass in variables the the socket will have local access to
export function createJupyterWebSocket(cookieString?: string, allowUnauthorized?: boolean) {
    class JupyterWebSocket extends WebSocketWS {
        private kernelId: string | undefined;
        private preListeners: ((data: WebSocketWS.Data) => Promise<void>)[];
        private msgChain: Promise<any>;

        constructor(url: string, protocols?: string | string[] | undefined) {
            let co: WebSocketWS.ClientOptions = {};

            if (allowUnauthorized) {
                co = { ...co, rejectUnauthorized: false };
            }

            if (cookieString) {
                co = {
                    ...co,
                    headers: {
                        Cookie: cookieString
                    }
                };
            }

            super(url, protocols, co);

            // Make sure the message chain is initialized
            this.msgChain = Promise.resolve();

            // Parse the url for the kernel id
            const parsed = /.*\/kernels\/(.*)\/.*/.exec(this.url);
            if (parsed && parsed.length > 1) {
                this.kernelId = parsed[1];
            }
            if (this.kernelId) {
                JupyterWebSockets.set(this.kernelId, this);
                this.on('close', () => {
                    JupyterWebSockets.delete(this.kernelId!);
                });
            } else {
                traceError('KernelId not extracted from Kernel WebSocket URL');
            }
            this.preListeners = [];
        }

        public emit(event: string | symbol, ...args: any[]): boolean {
            if (event === 'message') {
                // Stick the prelisteners into the message chain. We use chain
                // to ensure that:
                // a) Prelisteners finish before we fire the event for real
                // b) Event fires
                // c) Next message happens after this one (so this side can handle the message before another event goes through)
                this.msgChain = this.msgChain
                    .then(() => Promise.all(this.preListeners.map((p) => p(args[0]))))
                    .then(() => super.emit(event, ...args));
                // True value indicates there were handlers. We definitely have 'message' handlers.
                return true;
            } else {
                return super.emit(event, ...args);
            }
        }

        public addMessageListener(listener: (data: WebSocketWS.Data) => Promise<void>) {
            this.preListeners.push(listener);
        }
        public removeMessageListener(listener: (data: WebSocketWS.Data) => Promise<void>) {
            this.preListeners = this.preListeners.filter((l) => l !== listener);
        }
    }
    return JupyterWebSocket;
}
