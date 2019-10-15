// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';

// We need to override the websocket that jupyter lab services uses to put in our cookie information
// Do this as a function so that we can pass in variables the the socket will have local access to
export function createJupyterWebSocket(openEmitted: (sessionId: string | undefined) => void, cookieString?: string, allowUnauthorized?: boolean) {
    class JupyterWebSocket extends WebSocketWS {
        private sessionId: string | undefined;

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

            // Parse the url for the session id
            const parsed = /.*session_id=(.*)\&/.exec(url);
            if (parsed && parsed.length > 0) {
                this.sessionId = parsed[1];
            }
        }

        // tslint:disable-next-line: no-any
        public emit(event: string | symbol, ...args: any[]): boolean {
            const result = super.emit(event, ...args);
            if (event === 'open') {
                openEmitted(this.sessionId);
            }
            return result;
        }
    }
    return JupyterWebSocket;
}
