// tslint:disable:member-ordering no-any max-classes-per-file max-func-body-length

import * as assert from 'assert';
import * as getFreePort from 'get-port';
import * as net from 'net';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { SocketCallbackHandler } from '../../client/common/net/socket/socketCallbackHandler';
import { SocketServer } from '../../client/common/net/socket/socketServer';
import { SocketStream } from '../../client/common/net/socket/SocketStream';

// tslint:disable-next-line:no-require-imports no-var-requires
const uint64be = require('uint64be');

// tslint:disable-next-line:no-stateless-class
class Commands {
    public static ExitCommandBytes: Buffer = new Buffer('exit');
    public static PingBytes: Buffer = new Buffer('ping');
    public static ListKernelsBytes: Buffer = new Buffer('lstk');
}

namespace ResponseCommands {
    export const Pong = 'PONG';
    export const ListKernels = 'LSTK';
    export const Error = 'EROR';
}

const GUID = 'This is the Guid';
const PID = 1234;

class MockSocketCallbackHandler extends SocketCallbackHandler {
    constructor(socketServer: SocketServer) {
        super(socketServer);
        this.registerCommandHandler(ResponseCommands.Pong, this.onPong.bind(this));
        this.registerCommandHandler(ResponseCommands.Error, this.onError.bind(this));
    }

    private onError() {
        const message = this.stream.readStringInTransaction();
        if (message === undefined) {
            return;
        }
        this.emit('error', '', '', message);
    }
    public ping(message: string) {
        this.SendRawCommand(Commands.PingBytes);

        const stringBuffer = new Buffer(message);
        const buffer = Buffer.concat([Buffer.concat([new Buffer('U'), uint64be.encode(stringBuffer.byteLength)]), stringBuffer]);
        this.stream.Write(buffer);
    }

    private onPong() {
        const message = this.stream.readStringInTransaction();
        if (message === undefined) {
            return;
        }
        this.emit('pong', message);
    }

    private pid: number;
    private guid: string;

    protected handleHandshake(): boolean {
        if (!this.guid) {
            this.guid = this.stream.readStringInTransaction();
            if (this.guid === undefined) {
                return false;
            }
        }

        if (!this.pid) {
            this.pid = this.stream.readInt32InTransaction();
            if (this.pid === undefined) {
                return false;
            }
        }

        if (this.guid !== GUID) {
            this.emit('error', this.guid, GUID, 'Guids not the same');
            return true;
        }
        if (this.pid !== PID) {
            this.emit('error', this.pid, PID, 'pids not the same');
            return true;
        }

        this.emit('handshake');
        return true;
    }
}
class MockSocketClient {
    private socket: net.Socket;
    public SocketStream: SocketStream;
    constructor(private port: number) {

    }
    private def: Deferred<any>;
    public start(): Promise<any> {
        this.def = createDeferred<any>();
        this.socket = net.connect(this.port, this.connectionListener.bind(this));
        return this.def.promise;
    }
    private connectionListener() {
        this.SocketStream = new SocketStream(this.socket, new Buffer(''));
        this.def.resolve();

        this.socket.on('data', (data: Buffer) => {
            try {
                this.SocketStream.Append(data);
                // We can only receive ping messages
                this.SocketStream.BeginTransaction();
                const cmdId = new Buffer([this.SocketStream.ReadByte(), this.SocketStream.ReadByte(), this.SocketStream.ReadByte(), this.SocketStream.ReadByte()]).toString();
                const message = this.SocketStream.ReadString();
                if (message === undefined) {
                    this.SocketStream.EndTransaction();
                    return;
                }

                if (cmdId !== 'ping') {
                    this.SocketStream.Write(new Buffer(ResponseCommands.Error));

                    const errorMessage = `Received unknown command '${cmdId}'`;
                    const errorBuffer = Buffer.concat([Buffer.concat([new Buffer('A'), uint64be.encode(errorMessage.length)]), new Buffer(errorMessage)]);
                    this.SocketStream.Write(errorBuffer);
                    return;
                }

                this.SocketStream.Write(new Buffer(ResponseCommands.Pong));

                const messageBuffer = new Buffer(message);
                const pongBuffer = Buffer.concat([Buffer.concat([new Buffer('U'), uint64be.encode(messageBuffer.byteLength)]), messageBuffer]);
                this.SocketStream.Write(pongBuffer);
            } catch (ex) {
                this.SocketStream.Write(new Buffer(ResponseCommands.Error));

                const errorMessage = `Fatal error in handling data at socket client. Error: ${ex.message}`;
                const errorBuffer = Buffer.concat([Buffer.concat([new Buffer('A'), uint64be.encode(errorMessage.length)]), new Buffer(errorMessage)]);
                this.SocketStream.Write(errorBuffer);
            }
        });
    }
}

// Defines a Mocha test suite to group tests of similar kind together
suite('SocketCallbackHandler', () => {
    test('Succesfully starts without any specific host or port', async () => {
        const socketServer = new SocketServer();
        await socketServer.Start();
    });
    test('Succesfully starts with port=0 and no host', async () => {
        const socketServer = new SocketServer();
        await socketServer.Start({ port: 0 });
    });
    test('Succesfully starts with port=0 and host=localhost', async () => {
        const socketServer = new SocketServer();
        await socketServer.Start({ port: 0, host: 'localhost' });
    });
    test('Succesfully starts with host=127.0.0.1', async () => {
        const socketServer = new SocketServer();
        await socketServer.Start({ host: '127.0.0.1' });
    });
    test('Succesfully starts with port=0 and host=127.0.0.1', async () => {
        const socketServer = new SocketServer();
        await socketServer.Start({ port: 0, host: '127.0.0.1' });
    });
    test('Succesfully starts with specific port', async () => {
        const socketServer = new SocketServer();
        const availablePort = await getFreePort({ host: 'localhost' });
        const port = await socketServer.Start({ port: availablePort, host: 'localhost' });
        assert.equal(port, availablePort, 'Server is not listening on the provided port number');
    });
    test('Succesful Handshake', done => {
        const socketServer = new SocketServer();
        let socketClient: MockSocketClient;
        let callbackHandler: MockSocketCallbackHandler;
        socketServer.Start().then(port => {
            callbackHandler = new MockSocketCallbackHandler(socketServer);
            socketClient = new MockSocketClient(port);
            return socketClient.start();
        }).then(() => {
            const def = createDeferred<any>();
            let timeOut: NodeJS.Timer | undefined = setTimeout(() => {
                def.reject('Handshake not completed in allocated time');
            }, 5000);

            callbackHandler.on('handshake', () => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                def.resolve();
            });
            callbackHandler.on('error', (actual: string, expected: string, message: string) => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                def.reject({ actual: actual, expected: expected, message: message });
            });

            // Client has connected, now send information to the callback handler via sockets
            const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
            socketClient.SocketStream.Write(guidBuffer);
            socketClient.SocketStream.WriteInt32(PID);
            return def.promise;
        }).then(done).catch(done);
    });
    test('Unsuccesful Handshake', done => {
        const socketServer = new SocketServer();
        let socketClient: MockSocketClient;
        let callbackHandler: MockSocketCallbackHandler;
        socketServer.Start().then(port => {
            callbackHandler = new MockSocketCallbackHandler(socketServer);
            socketClient = new MockSocketClient(port);
            return socketClient.start();
        }).then(() => {
            const def = createDeferred<any>();
            let timeOut: NodeJS.Timer | undefined = setTimeout(() => {
                def.reject('Handshake not completed in allocated time');
            }, 5000);

            callbackHandler.on('handshake', () => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                def.reject('handshake should fail, but it succeeded!');
            });
            callbackHandler.on('error', (actual: string | number, expected: string, message: string) => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                if (actual === 0 && message === 'pids not the same') {
                    def.resolve();
                } else {
                    def.reject({ actual: actual, expected: expected, message: message });
                }
            });

            // Client has connected, now send information to the callback handler via sockets
            const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
            socketClient.SocketStream.Write(guidBuffer);

            // Send the wrong pid
            socketClient.SocketStream.WriteInt32(0);
            return def.promise;
        }).then(done).catch(done);
    });
    test('Ping with message', done => {
        const socketServer = new SocketServer();
        let socketClient: MockSocketClient;
        let callbackHandler: MockSocketCallbackHandler;
        socketServer.Start().then(port => {
            callbackHandler = new MockSocketCallbackHandler(socketServer);
            socketClient = new MockSocketClient(port);
            return socketClient.start();
        }).then(() => {
            const def = createDeferred<any>();
            const PING_MESSAGE = 'This is the Ping Message - Функция проверки ИНН и КПП - 说明';
            let timeOut: NodeJS.Timer | undefined = setTimeout(() => {
                def.reject('Handshake not completed in allocated time');
            }, 5000);

            callbackHandler.on('handshake', () => {
                // Send a custom message (only after handshake has been done)
                callbackHandler.ping(PING_MESSAGE);
            });
            callbackHandler.on('pong', (message: string) => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                try {
                    assert.equal(message, PING_MESSAGE);
                    def.resolve();
                } catch (ex) {
                    def.reject(ex);
                }
            });
            callbackHandler.on('error', (actual: string, expected: string, message: string) => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                def.reject({ actual: actual, expected: expected, message: message });
            });

            // Client has connected, now send information to the callback handler via sockets
            const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
            socketClient.SocketStream.Write(guidBuffer);

            // Send the wrong pid
            socketClient.SocketStream.WriteInt32(PID);
            return def.promise;
        }).then(done).catch(done);
    });
    test('Succesful Handshake with port=0 and host=localhost', done => {
        const socketServer = new SocketServer();
        let socketClient: MockSocketClient;
        let callbackHandler: MockSocketCallbackHandler;
        socketServer.Start({ port: 0, host: 'localhost' }).then(port => {
            callbackHandler = new MockSocketCallbackHandler(socketServer);
            socketClient = new MockSocketClient(port);
            return socketClient.start();
        }).then(() => {
            const def = createDeferred<any>();
            let timeOut: NodeJS.Timer | undefined = setTimeout(() => {
                def.reject('Handshake not completed in allocated time');
            }, 5000);

            callbackHandler.on('handshake', () => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                def.resolve();
            });
            callbackHandler.on('error', (actual: string, expected: string, message: string) => {
                if (timeOut) {
                    clearTimeout(timeOut);
                    timeOut = undefined;
                }
                def.reject({ actual: actual, expected: expected, message: message });
            });

            // Client has connected, now send information to the callback handler via sockets
            const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
            socketClient.SocketStream.Write(guidBuffer);
            socketClient.SocketStream.WriteInt32(PID);
            return def.promise;
        }).then(done).catch(done);
    });
    test('Succesful Handshake with specific port', done => {
        const socketServer = new SocketServer();
        let socketClient: MockSocketClient;
        let callbackHandler: MockSocketCallbackHandler;
        let availablePort = 0;
        new Promise<number>((resolve, reject) => getFreePort({ host: 'localhost' }).then(resolve, reject))
            .then(port => {
                availablePort = port;
                return socketServer.Start({ port, host: 'localhost' });
            })
            .then(port => {
                assert.equal(port, availablePort, 'Server is not listening on the provided port number');
                callbackHandler = new MockSocketCallbackHandler(socketServer);
                socketClient = new MockSocketClient(port);
                return socketClient.start();
            })
            .then(() => {
                const def = createDeferred<any>();
                let timeOut: NodeJS.Timer | undefined = setTimeout(() => {
                    def.reject('Handshake not completed in allocated time');
                }, 5000);

                callbackHandler.on('handshake', () => {
                    if (timeOut) {
                        clearTimeout(timeOut);
                        timeOut = undefined;
                    }
                    def.resolve();
                });
                callbackHandler.on('error', (actual: string, expected: string, message: string) => {
                    if (timeOut) {
                        clearTimeout(timeOut);
                        timeOut = undefined;
                    }
                    def.reject({ actual: actual, expected: expected, message: message });
                });

                // Client has connected, now send information to the callback handler via sockets
                const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
                socketClient.SocketStream.Write(guidBuffer);
                socketClient.SocketStream.WriteInt32(PID);
                return def.promise;
            })
            .then(done)
            .catch(done);
    });
});
