"use strict";

import * as net from "net";
import { EventEmitter } from 'events';
import { createDeferred } from '../../helpers';

export class SocketServer extends EventEmitter {
    private socketServer: net.Server = null;
    constructor() {
        super();
    }

    public Stop() {
        if (this.socketServer === null) { return; }
        try {
            this.socketServer.close();
        }
        catch (ex) { }
        this.socketServer = null;
    }

    public Start(): Promise<number> {
        const def = createDeferred<number>();
        this.socketServer = net.createServer(this.connectionListener.bind(this));

        this.socketServer.listen(0, function (this: SocketServer) {
            def.resolve(this.socketServer.address().port);
        }.bind(this));

        this.socketServer.on("error", ex => {
            console.error('Error in Socket Server', ex);
            if (def.completed) {
                // Ooops
                debugger;
            }
            const msg = `Failed to start the socket server. (Error: ${ex.message})`;

            def.reject(msg);
        });
        return def.promise;
    }

    private connectionListener(client: net.Socket) {
        client.on("close", function () {
            this.emit('close', client);
        }.bind(this));
        client.on("data", function (data: Buffer) {
            this.emit('data', client, data);
        }.bind(this));

        client.on("timeout", d => {
            // let msg = "Debugger client timedout, " + d;
        });
    }
}
