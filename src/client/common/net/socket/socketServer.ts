import { EventEmitter } from 'events';
import * as net from 'net';
import { createDeferred } from '../../helpers';

export class SocketServer extends EventEmitter {
    private socketServer: net.Server | undefined;
    constructor() {
        super();
    }

    public Stop() {
        if (!this.socketServer) { return; }
        try {
            this.socketServer.close();
            // tslint:disable-next-line:no-empty
        } catch (ex) { }
        this.socketServer = undefined;
    }

    public Start(options: { port?: number, host?: string } = {}): Promise<number> {
        const def = createDeferred<number>();
        this.socketServer = net.createServer(this.connectionListener.bind(this));

        const port = typeof options.port === 'number' ? options.port! : 0;
        const host = typeof options.host === 'string' ? options.host! : 'localhost';
        this.socketServer!.listen({ port, host }, () => {
            def.resolve(this.socketServer!.address().port);
        });

        this.socketServer!.on('error', ex => {
            console.error('Error in Socket Server', ex);
            const msg = `Failed to start the socket server. (Error: ${ex.message})`;

            def.reject(msg);
        });
        return def.promise;
    }

    private connectionListener(client: net.Socket) {
        client.on('close', () => {
            this.emit('close', client);
        });
        client.on('data', (data: Buffer) => {
            this.emit('data', client, data);
        });

        client.on('timeout', d => {
            // let msg = "Debugger client timedout, " + d;
        });
    }
}
