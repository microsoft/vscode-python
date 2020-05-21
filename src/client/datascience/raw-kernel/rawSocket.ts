// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import type { KernelMessage } from '@jupyterlab/services';
import * as wireProtocol from '@nteract/messaging/lib/wire-protocol';
import { IDisposable } from 'monaco-editor';
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
interface IChannels {
    shell: Dealer;
    control: Dealer;
    stdin: Dealer;
    iopub: Subscriber;
}

// tslint:disable: no-any
/**
 * This class creates a WebSocket front end on a ZMQ set of connections. It is special in that
 * it does all serialization/deserialization itself.
 */
export class RawSocket implements IWebSocketLike, IKernelSocket, IDisposable {
    public onopen: (event: { target: any }) => void = noop;
    public onerror: (event: { error: any; message: string; type: string; target: any }) => void = noop;
    public onclose: (event: { wasClean: boolean; code: number; reason: string; target: any }) => void = noop;
    public onmessage: (event: { data: WebSocketWS.Data; type: string; target: any }) => void = noop;
    private receiveHooks: ((data: WebSocketWS.Data) => Promise<void>)[] = [];
    private sendHooks: ((data: any, cb?: (err?: Error) => void) => Promise<void>)[] = [];
    private msgChain: Promise<any> = Promise.resolve();
    private sendChain: Promise<any> = Promise.resolve();
    private channels: IChannels;
    private closed = false;

    constructor(
        private connection: IKernelConnection,
        private serialize: (msg: KernelMessage.IMessage) => string | ArrayBuffer,
        private deserialize: (data: ArrayBuffer | string) => KernelMessage.IMessage
    ) {
        // Setup our ZMQ channels now
        this.channels = this.generateChannels(connection);
    }

    public dispose() {
        if (!this.closed) {
            this.close();
        }
    }

    public close(): void {
        this.closed = true;
        // When the socket is completed / disposed, close all the event
        // listeners and shutdown the socket
        const closer = (closable: { close(): void }) => {
            try {
                closable.close();
            } catch (ex) {
                traceError(`Error during socket shutdown`, ex);
            }
        };
        closer(this.channels.control);
        closer(this.channels.iopub);
        closer(this.channels.shell);
        closer(this.channels.stdin);
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
    private generateChannel<T extends Subscriber | Dealer>(
        connection: IKernelConnection,
        channel: 'iopub' | 'shell' | 'control' | 'stdin',
        ctor: () => T
    ): T {
        const result = ctor();
        result.connect(formConnectionString(connection, channel));
        this.processSocketMessages(channel, result).catch(
            traceError.bind(`Failed to read messages from channel ${channel}`)
        );
        return result;
    }
    private async processSocketMessages(
        channel: 'iopub' | 'shell' | 'control' | 'stdin',
        readable: Subscriber | Dealer
    ) {
        // tslint:disable-next-line: await-promise
        for await (const msg of readable) {
            // Make sure to quit if we are disposed.
            if (this.closed) {
                break;
            } else {
                this.onIncomingMessage(channel, msg);
            }
        }
    }

    private generateChannels(connection: IKernelConnection): IChannels {
        // tslint:disable-next-line: no-require-imports
        const zmq = require('zeromq') as typeof import('zeromq');

        // Need a routing id for them to share.
        const routingId = uuid();

        // Wire up all of the different channels.
        const result: IChannels = {
            iopub: this.generateChannel(connection, 'iopub', () => new zmq.Subscriber()),
            shell: this.generateChannel(connection, 'shell', () => new zmq.Dealer({ routingId })),
            control: this.generateChannel(connection, 'control', () => new zmq.Dealer({ routingId })),
            stdin: this.generateChannel(connection, 'stdin', () => new zmq.Dealer({ routingId }))
        };
        // What about hb port? Enchannel didn't use this one.

        // Make sure to subscribe to general iopub messages (this is stuff like status changes)
        result.iopub.subscribe();

        return result;
    }

    private onIncomingMessage(channel: string, data: any) {
        // Decode the message if still possible.
        const message = this.closed
            ? {}
            : (wireProtocol.decode(data, this.connection.key, this.connection.signature_scheme) as any);

        // Make sure it has a channel on it
        message.channel = channel;

        if (this.receiveHooks.length) {
            // Stick the receive hooks into the message chain. We use chain
            // to ensure that:
            // a) Hooks finish before we fire the event for real
            // b) Event fires
            // c) Next message happens after this one (so this side can handle the message before another event goes through)
            this.msgChain = this.msgChain
                .then(() => {
                    // Hooks expect serialized data as this normally comes from a WebSocket
                    const serialized = this.serialize(message);
                    return Promise.all(this.receiveHooks.map((p) => p(serialized)));
                })
                .then(() => this.fireOnMessage(message));
        } else {
            this.msgChain = this.msgChain.then(() => this.fireOnMessage(message));
        }
    }

    private fireOnMessage(message: any) {
        if (!this.closed) {
            this.onmessage({ data: message, type: 'message', target: this });
        }
    }

    private sendMessage(msg: KernelMessage.IMessage, bypassHooking: boolean) {
        // First encode the message.
        const data = wireProtocol.encode(msg as any, this.connection.key, this.connection.signature_scheme);

        // Then send through our hooks, and then post to the real zmq socket
        if (!bypassHooking && this.sendHooks.length) {
            // Separate encoding for ipywidgets. It expects the same result a WebSocket would generate.
            const hookData = this.serialize(msg);

            this.sendChain = this.sendChain
                .then(() => Promise.all(this.sendHooks.map((s) => s(hookData, noop))))
                .then(() => this.postToSocket(msg.channel, data));
        } else {
            this.sendChain = this.sendChain.then(() => {
                this.postToSocket(msg.channel, data);
            });
        }
    }

    private postToSocket(channel: string, data: any) {
        const socket = (this.channels as any)[channel];
        if (socket) {
            (socket as Dealer).send(data).catch((exc) => {
                traceError(`Error communicating with the kernel`, exc);
            });
        } else {
            traceError(`Attempting to send message on invalid channel: ${channel}`);
        }
    }
}
