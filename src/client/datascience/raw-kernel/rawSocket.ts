// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { KernelMessage } from '@jupyterlab/services';
import * as wireProtocol from '@nteract/messaging/lib/wire-protocol';
import * as Events from 'events';
import * as uuid from 'uuid/v4';
import * as WebSocketWS from 'ws';
import type { Dealer, Subscriber } from 'zeromq';
import { traceError } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { IKernelConnection } from '../kernel-launcher/types';
import { IWebSocketLike } from '../kernelSocketWrapper';
import { IKernelSocket } from '../types';

function formConnectionString(config: IKernelConnection, channel: string) {
    const portDelimiter = config.transport === 'tcp' ? ':' : '-';
    const port = config[`${channel}_port` as keyof IKernelConnection];
    if (!port) {
        throw new Error(`Port not found for channel "${channel}"`);
    }
    return `${config.transport}://${config.ip}${portDelimiter}${port}`;
}

class SocketEventEmitter extends Events.EventEmitter {
    constructor(socket: Dealer | Subscriber) {
        super();
        this.waitForReceive(socket);
    }

    private waitForReceive(socket: Dealer | Subscriber) {
        if (!socket.closed) {
            // tslint:disable-next-line: no-floating-promises
            socket
                .receive()
                .then((b) => {
                    this.emit('message', b);
                    setTimeout(this.waitForReceive.bind(this, socket), 0);
                })
                .catch((exc) => {
                    traceError('Exception communicating with kernel:', exc);
                });
        }
    }
}

// tslint:disable: no-any
/**
 * This class creates a WebSocket front end on a ZMQ set of connections. It is special in that
 * it does all serialization/deserialization itself.
 */
export class RawSocket implements IWebSocketLike, IKernelSocket {
    public onopen: (event: { target: any }) => void = noop;
    public onerror: (event: { error: any; message: string; type: string; target: any }) => void = noop;
    public onclose: (event: { wasClean: boolean; code: number; reason: string; target: any }) => void = noop;
    public onmessage: (event: { data: WebSocketWS.Data; type: string; target: any }) => void = noop;
    private deserialize: (data: ArrayBuffer | string) => KernelMessage.IMessage;
    private receiveHooks: ((data: WebSocketWS.Data) => Promise<void>)[] = [];
    private sendHooks: ((data: any, cb?: (err?: Error) => void) => Promise<void>)[] = [];
    private msgChain: Promise<any> = Promise.resolve();
    private sendChain: Promise<any> = Promise.resolve();
    private zmqSockets: Map<string, Subscriber | Dealer> = new Map<string, Subscriber | Dealer>();
    private zmqEmitters: Map<string, SocketEventEmitter> = new Map<string, SocketEventEmitter>();

    constructor(private connection: IKernelConnection) {
        // tslint:disable-next-line: no-require-imports
        const jupyterLabSerialize = require('@jupyterlab/services/lib/kernel/serialize') as typeof import('@jupyterlab/services/lib/kernel/serialize'); // NOSONAR
        this.deserialize = jupyterLabSerialize.deserialize;

        // Setup our ZMQ connections now
        this.generateZMQConnections(connection);
    }

    public emit(event: string | symbol, ...args: any[]): boolean {
        switch (event) {
            case 'message':
                this.onmessage({ data: args[0], type: 'message', target: this });
                break;
            case 'close':
                this.onclose({ wasClean: true, code: 0, reason: '', target: this });
                break;
            case 'error':
                this.onerror({ error: '', message: 'to do', type: 'error', target: this });
                break;
            case 'open':
                this.onopen({ target: this });
                break;
            default:
                break;
        }
        return true;
    }
    public sendToRealKernel(data: any, _callback: any): void {
        // If from ipywidgets, this will be serialized already, so turn it back into a message so
        // we can add the special hash to it.
        const message = this.deserialize(data);

        // Send this directly (don't call back into the hooks)
        this.sendMessage(message, true);
    }

    public send(data: any, _callback: any): void {
        // This comes directly from the jupyter lab kernel. It should be a message already
        this.sendMessage(data as KernelMessage.IMessage, false);
    }

    public addReceiveHook(hook: (data: WebSocketWS.Data) => Promise<void>): void {
        this.receiveHooks.push(hook);
    }
    public removeReceiveHook(hook: (data: WebSocketWS.Data) => Promise<void>): void {
        this.receiveHooks = this.receiveHooks.filter((l) => l !== hook);
    }
    public addSendHook(hook: (data: any, cb?: ((err?: Error | undefined) => void) | undefined) => Promise<void>): void {
        this.sendHooks.push(hook);
    }
    public removeSendHook(
        hook: (data: any, cb?: ((err?: Error | undefined) => void) | undefined) => Promise<void>
    ): void {
        this.sendHooks = this.sendHooks.filter((p) => p !== hook);
    }

    private generateChannelConnection<T extends Subscriber | Dealer>(
        connection: IKernelConnection,
        channel: string,
        ctor: () => T
    ) {
        const result = ctor();
        result.connect(formConnectionString(connection, channel));
        this.zmqSockets.set(channel, result);
        const emitter = new SocketEventEmitter(result);
        emitter.on('message', this.onIncomingMessage.bind(this, channel));
        this.zmqEmitters.set(channel, emitter);
    }

    private generateZMQConnections(connection: IKernelConnection) {
        // tslint:disable-next-line: no-require-imports
        const zmq = require('zeromq') as typeof import('zeromq');

        // Wire up all of the different channels.
        this.generateChannelConnection(connection, 'iopub', () => new zmq.Subscriber());
        this.generateChannelConnection(connection, 'shell', () => new zmq.Dealer({ routingId: uuid() }));
        this.generateChannelConnection(connection, 'control', () => new zmq.Dealer({ routingId: uuid() }));
        this.generateChannelConnection(connection, 'stdin', () => new zmq.Dealer({ routingId: uuid() }));

        // What about hb port? Enchannel didn't use this one.
    }

    private onIncomingMessage(channel: string, data: any) {
        // Data is in an array buffer format. We need to keep it that way for message hooks, but not for the real
        // kernel.
        if (this.receiveHooks.length) {
            // Stick the receive hooks into the message chain. We use chain
            // to ensure that:
            // a) Hooks finish before we fire the event for real
            // b) Event fires
            // c) Next message happens after this one (so this side can handle the message before another event goes through)
            this.msgChain = this.msgChain
                .then(() => Promise.all(this.receiveHooks.map((p) => p(data))))
                .then(() => this.postIncomingMessage(channel, data));
        } else {
            this.msgChain = this.msgChain.then(() => this.postIncomingMessage(channel, data));
        }
    }

    private postIncomingMessage(channel: string, data: any) {
        // Decode the message and send it to the jupyterlab kernel. Since its deserialize function has
        // been removed, deserialize it here.
        const message = wireProtocol.decode(data, this.connection.key, this.connection.signature_scheme) as any;

        // Make sure it has a channel on it. Note: Does this need to be on the ipywidgets version too?
        message.channel = channel;

        this.onmessage({ data: message, type: 'message', target: this });
    }

    private sendMessage(msg: KernelMessage.IMessage, bypassHooking: boolean) {
        // First encode the message.
        const data = wireProtocol.encode(msg as any, this.connection.key, this.connection.signature_scheme);

        // Then send through our hooks, and then post to the real zmq socket
        if (!bypassHooking && this.sendHooks.length) {
            this.sendChain = this.sendChain
                .then(() => Promise.all(this.sendHooks.map((s) => s(data, noop))))
                .then(() => this.postToSocket(msg.channel, data));
        } else {
            this.sendChain = this.sendChain.then(() => {
                this.postToSocket(msg.channel, data);
            });
        }
    }

    private postToSocket(channel: string, data: any) {
        const socket = this.zmqSockets.get(channel);
        if (socket) {
            (socket as Dealer).send(data).catch((exc) => {
                traceError(`Error communicating with the kernel`, exc);
            });
        }
    }
}
