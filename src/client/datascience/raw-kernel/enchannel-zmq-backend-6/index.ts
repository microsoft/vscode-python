// This code was copied from https://github.com/nteract/enchannel-zmq-backend/blob/master/src/index.ts
// and modified to work with zeromq-beta-6

import { Channels, JupyterMessage } from '@nteract/messaging';
import * as wireProtocol from '@nteract/messaging/lib/wire-protocol';
import * as Events from 'events';
import * as rxjs from 'rxjs';
import { map, publish, refCount } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import * as zeromq from 'zeromq';
import { traceError } from '../../../common/logger';

type ChannelName = 'iopub' | 'stdin' | 'shell' | 'control';

// tslint:disable: interface-name no-any
export interface JupyterConnectionInfo {
    version: number;
    iopub_port: number;
    shell_port: number;
    stdin_port: number;
    control_port: number;
    signature_scheme: 'hmac-sha256';
    hb_port: number;
    ip: string;
    key: string;
    transport: 'tcp' | 'ipc';
}

interface HeaderFiller {
    session: string;
    username: string;
}

/**
 * Takes a Jupyter spec connection info object and channel and returns the
 * string for a channel. Abstracts away tcp and ipc connection string
 * formatting
 *
 * @param config  Jupyter connection information
 * @param channel Jupyter channel ("iopub", "shell", "control", "stdin")
 *
 * @returns The connection string
 */
export const formConnectionString = (config: JupyterConnectionInfo, channel: ChannelName) => {
    const portDelimiter = config.transport === 'tcp' ? ':' : '-';
    const port = config[`${channel}_port` as keyof JupyterConnectionInfo];
    if (!port) {
        throw new Error(`Port not found for channel "${channel}"`);
    }
    return `${config.transport}://${config.ip}${portDelimiter}${port}`;
};

/**
 * Creates a socket for the given channel with ZMQ channel type given a config
 *
 * @param channel Jupyter channel ("iopub", "shell", "control", "stdin")
 * @param identity UUID
 * @param config  Jupyter connection information
 *
 * @returns The new Jupyter ZMQ socket
 */
export async function createSubscriber(
    channel: ChannelName,
    config: JupyterConnectionInfo
): Promise<zeromq.Subscriber> {
    const socket = new zeromq.Subscriber();

    const url = formConnectionString(config, channel);
    socket.connect(url);
    return socket;
}

/**
 * Creates a socket for the given channel with ZMQ channel type given a config
 *
 * @param channel Jupyter channel ("iopub", "shell", "control", "stdin")
 * @param identity UUID
 * @param config  Jupyter connection information
 *
 * @returns The new Jupyter ZMQ socket
 */
export async function createDealer(
    channel: ChannelName,
    identity: string,
    config: JupyterConnectionInfo
): Promise<zeromq.Dealer> {
    // tslint:disable-next-line: no-require-imports
    const socket = new zeromq.Dealer({ routingId: identity });

    const url = formConnectionString(config, channel);
    socket.connect(url);
    return socket;
}

export const getUsername = () =>
    process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME || 'username'; // This is the fallback that the classic notebook uses

interface Sockets {
    shell: zeromq.Dealer;
    control: zeromq.Dealer;
    stdin: zeromq.Dealer;
    iopub: zeromq.Subscriber;
}

/**
 * Sets up the sockets for each of the jupyter channels.
 *
 * @param config Jupyter connection information
 * @param subscription The topic to filter the subscription to the iopub channel on
 * @param identity UUID
 * @param jmp A reference to the JMP Node module
 *
 * @returns Sockets for each Jupyter channel
 */
export const createSockets = async (
    config: JupyterConnectionInfo,
    subscription: string = '',
    identity = uuid()
): Promise<Sockets> => {
    const [shell, control, stdin, iopub] = await Promise.all([
        createDealer('shell', identity, config),
        createDealer('control', identity, config),
        createDealer('stdin', identity, config),
        createSubscriber('iopub', config)
    ]);

    // NOTE: ZMQ PUB/SUB subscription (not an Rx subscription)
    iopub.subscribe(subscription);

    return {
        shell,
        control,
        stdin,
        iopub
    };
};

class SocketEventEmitter extends Events.EventEmitter {
    constructor(socket: zeromq.Dealer | zeromq.Subscriber) {
        super();
        this.waitForReceive(socket);
    }

    private waitForReceive(socket: zeromq.Dealer | zeromq.Subscriber) {
        if (!socket.closed) {
            // tslint:disable-next-line: no-floating-promises
            socket
                .receive()
                .then(b => {
                    this.emit('message', b);
                    setTimeout(this.waitForReceive.bind(this, socket), 0);
                })
                .ignoreErrors();
        }
    }
}

/**
 * Creates a multiplexed set of channels.
 *
 * @param sockets An object containing associations between channel types and 0MQ sockets
 * @param header The session and username to place in kernel message headers
 * @param jmp A reference to the JMP Node module
 *
 * @returns Creates an Observable for each channel connection that allows us
 * to send and receive messages through the Jupyter protocol.
 */
export const createMainChannelFromSockets = (
    sockets: Sockets,
    connectionInfo: JupyterConnectionInfo,
    header: HeaderFiller = {
        session: uuid(),
        username: getUsername()
    }
): Channels => {
    // The mega subject that encapsulates all the sockets as one multiplexed
    // stream
    const outgoingMessages = rxjs.Subscriber.create<JupyterMessage>(
        async message => {
            // There's always a chance that a bad message is sent, we'll ignore it
            // instead of consuming it
            if (!message || !message.channel) {
                console.warn('message sent without a channel', message);
                return;
            }
            const socket = (sockets as any)[message.channel];
            if (!socket) {
                // If, for some reason, a message is sent on a channel we don't have
                // a socket for, warn about it but don't bomb the stream
                console.warn('channel not understood for message', message);
                return;
            }
            try {
                const jMessage: wireProtocol.RawJupyterMessage = {
                    // Fold in the setup header to ease usage of messages on channels
                    header: { ...message.header, ...header },
                    parent_header: message.parent_header as any,
                    content: message.content,
                    metadata: message.metadata,
                    buffers: message.buffers as any,
                    idents: []
                };
                if ((socket as any).send !== undefined) {
                    await (socket as zeromq.Dealer).send(
                        wireProtocol.encode(jMessage, connectionInfo.key, connectionInfo.signature_scheme)
                    );
                }
            } catch (err) {
                traceError('Error sending message', err, message);
            }
        },
        undefined, // not bothering with sending errors on
        () => {
            // When the subject is completed / disposed, close all the event
            // listeners and shutdown the socket
            const closer = (closable: { close(): void }) => {
                try {
                    closable.close();
                } catch (ex) {
                    traceError(`Error during socket shutdown`, ex);
                }
            };
            closer(sockets.control);
            closer(sockets.iopub);
            closer(sockets.shell);
            closer(sockets.stdin);
        }
    );

    // Messages from kernel on the sockets
    const incomingMessages: rxjs.Observable<JupyterMessage> = rxjs
        .merge(
            // Form an Observable with each socket
            ...Object.keys(sockets).map(name => {
                // Wrap in something that will emit an event whenever a message is received.
                const socketEmitter = new SocketEventEmitter((sockets as any)[name]);
                return rxjs.fromEvent(socketEmitter, 'message').pipe(
                    map(
                        (body: any): JupyterMessage => {
                            const message = wireProtocol.decode(
                                body,
                                connectionInfo.key,
                                connectionInfo.signature_scheme
                            ) as any;
                            // Add on our channel property
                            message.channel = name;
                            return message;
                        }
                    ),
                    publish(),
                    refCount()
                );
            })
        )
        .pipe(publish(), refCount());

    return rxjs.Subject.create(outgoingMessages, incomingMessages);
};

/**
 * Creates a multiplexed set of channels.
 *
 * @param  config                  Jupyter connection information
 * @param  config.ip               IP address of the kernel
 * @param  config.transport        Transport, e.g. TCP
 * @param  config.signature_scheme Hashing scheme, e.g. hmac-sha256
 * @param  config.iopub_port       Port for iopub channel
 * @param  subscription            subscribed topic; defaults to all
 * @param  identity                UUID
 *
 * @returns Subject containing multiplexed channels
 */
export const createMainChannel = async (
    config: JupyterConnectionInfo,
    subscription: string = '',
    identity: string = uuid(),
    header: HeaderFiller = {
        session: uuid(),
        username: getUsername()
    }
): Promise<Channels> => {
    const sockets = await createSockets(config, subscription, identity);
    return createMainChannelFromSockets(sockets, config, header);
};
