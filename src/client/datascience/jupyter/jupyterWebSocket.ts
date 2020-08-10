// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';
import { traceError } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { KernelSocketWrapper } from '../kernelSocketWrapper';
import { IKernelSocket } from '../types';

// tslint:disable: no-any
export const JupyterWebSockets = new Map<string, WebSocketWS & IKernelSocket>(); // NOSONAR

// We need to override the websocket that jupyter lab services uses to put in our cookie information
// Do this as a function so that we can pass in variables the the socket will have local access to
export function createJupyterWebSocket(cookieString?: string, allowUnauthorized?: boolean, getAuthHeaders?: () => any) {
    class JupyterWebSocket extends KernelSocketWrapper(WebSocketWS) {
        private kernelId: string | undefined;
        private timer: NodeJS.Timeout | number;

        constructor(url: string, protocols?: string | string[] | undefined) {
            let co: WebSocketWS.ClientOptions = {};
            let co_headers: { [key: string]: string } | undefined;

            if (allowUnauthorized) {
                co = { ...co, rejectUnauthorized: false };
            }

            if (cookieString) {
                co_headers = { Cookie: cookieString };
            }

            // Auth headers have to be refetched every time we create a connection. They may have expired
            // since the last connection.
            if (getAuthHeaders) {
                const authorizationHeader = getAuthHeaders();
                co_headers = co_headers ? { ...co_headers, ...authorizationHeader } : authorizationHeader;
            }
            if (co_headers) {
                co = { ...co, headers: co_headers };
            }

            super(url, protocols, co);

            // Parse the url for the kernel id
            const parsed = /.*\/kernels\/(.*)\/.*/.exec(url);
            if (parsed && parsed.length > 1) {
                this.kernelId = parsed[1];
            }
            if (this.kernelId) {
                JupyterWebSockets.set(this.kernelId, this);
                this.on('close', () => {
                    clearInterval(this.timer as any);
                    JupyterWebSockets.delete(this.kernelId!);
                });
            } else {
                traceError('KernelId not extracted from Kernel WebSocket URL');
            }

            // Ping the websocket connection every 30 seconds to make sure it stays alive
            this.timer = setInterval(() => this.ping(noop), 30_000);
        }
    }
    return JupyterWebSocket;
}
