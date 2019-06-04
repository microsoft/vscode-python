// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';

// We need to override the websocket that jupyter lab services uses to put in our cookie information
export class JupyterWebSocket extends WebSocketWS {
    // IANHU: We need to make sure these are set / cleared on each connection attempt
    // Might be a better way to pass them, but jupyter lab services controls construction of this
    // Static fields for cookie values
    public static xsrfCookie: string | undefined;
    public static sessionName: string | undefined;
    public static sessionValue: string | undefined;

    constructor(url: string, protocols?: string | string[] | undefined) {
        if (JupyterWebSocket.xsrfCookie && JupyterWebSocket.sessionName && JupyterWebSocket.sessionValue) {
            // Create header cookie
            const cookieString = `_xsrf=${JupyterWebSocket.xsrfCookie}; ${JupyterWebSocket.sessionName}=${JupyterWebSocket.sessionValue}`;

            // Construct our client options here
            const co: WebSocketWS.ClientOptions = {
                headers: {
                    Cookie: cookieString
                }
            };

            super(url, protocols, co);
        } else {
            super(url, protocols);
        }
    }

}
