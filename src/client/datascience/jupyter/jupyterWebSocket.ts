// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';

// We need to override the websocket that jupyter lab services uses to put in our cookie information
export class JupyterWebSocket extends WebSocketWS {
    // Static fields for cookie values set by our Jupyter connection code
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
