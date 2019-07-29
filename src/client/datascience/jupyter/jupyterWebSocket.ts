// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';

// We need to override the websocket that jupyter lab services uses to put in our cookie information
// Do this as a function so that we can pass in variables the the socket will have local access to
export function createJupyterWebSocket(cookieString?: string, allowUnauthorized?: boolean) {
    class JupyterWebSocket extends WebSocketWS {
        constructor(url: string, protocols?: string | string[] | undefined) {
            let co: WebSocketWS.ClientOptions = {};

            if (allowUnauthorized) {
                co = { ...co, rejectUnauthorized: false };
            }

            if (cookieString) {
                co = {
                    ...co, headers: {
                        Cookie: cookieString
                    }
                };
            }

            super(url, protocols, co);
        }
    }
    return JupyterWebSocket;
}
