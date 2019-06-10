// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as WebSocketWS from 'ws';

// We need to override the websocket that jupyter lab services uses to put in our cookie information
export class JupyterWebSocket extends WebSocketWS {
    // Static field for cookie values set by our Jupyter connection code
    public static cookieString: string | undefined;

    constructor(url: string, protocols?: string | string[] | undefined) {
        if (JupyterWebSocket.cookieString) {
            // Construct our client options here
            const co: WebSocketWS.ClientOptions = {
                headers: {
                    Cookie: JupyterWebSocket.cookieString
                }
            };

            super(url, protocols, co);
        } else {
            super(url, protocols);
        }
    }

}
