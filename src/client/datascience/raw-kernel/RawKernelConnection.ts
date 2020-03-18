import { wireProtocol } from '@nteract/messaging';
//import { KernelMessage } from '@jupyterlab/services';
import * as zmq from 'zeromq';
import { IDisposable } from '../../common/types';

export interface RawKernelConnectionInfo {
    version: number;
    iopub_port: number;
    shell_port: number;
    stdin_port: number;
    control_port: number;
    signature_scheme: string;
    hb_port: number;
    ip: string;
    key: string;
    transport: string;
}

interface RawJupyterMessageHeader {
    msg_id: string;
    username: string;
    date: string;
    msg_type: string;
    version: string;
    session: string;
}

interface RawJupyterMessage {
    header: RawJupyterMessageHeader;
    parent_header: RawJupyterMessageHeader;
    metadata: object;
    content: object;
    buffers: Array<Buffer>;
    idents: Array<Buffer>;
}

export type ChannelName = "iopub" | "stdin" | "shell" | "control";

// IANHU: Encode / decode moved to a service behind interface?
// IANHU: Types for message classes? Don't like the any here
function encodeMessage(message: RawJupyterMessage, key: string | undefined, scheme: string | undefined): Buffer[] {
    return wireProtocol.encode(message as any, key, scheme);
}

function decodeMessage(frames: Buffer[], key: string | undefined, scheme: string | undefined): RawJupyterMessage {
    return wireProtocol.decode(frames, key, scheme) as any;
}

// Fill out any missing defaults from the input message
function initializeRawMessage(message: Partial<RawJupyterMessage>): RawJupyterMessage {
    const newMessage = Object.assign(
        {},
        {
            header: {},
            parent_header: {},
            metadata: {},
            content: {},
            idents: [],
            buffers: []
        },
        message
    );

    return newMessage;
}

export class RawKernelConnection implements IDisposable {
    // Our sockets that we will connect to
    private iopubSocket: zmq.Subscriber;
    private stdinSocket: zmq.Dealer;
    private shellSocket: zmq.Dealer;
    private controlSocket: zmq.Dealer;
    private connectionInfo: RawKernelConnectionInfo;

    public isDisposed = false;

    constructor(kernelConnectInfo: RawKernelConnectionInfo) {
        this.connectionInfo = kernelConnectInfo;

        // Clean this up. Promise all?
        this.iopubSocket = this.createSocket(kernelConnectInfo, 'iopub') as zmq.Subscriber;
        this.stdinSocket = this.createSocket(kernelConnectInfo, 'stdin') as zmq.Dealer;
        this.shellSocket = this.createSocket(kernelConnectInfo, 'shell') as zmq.Dealer;
        this.controlSocket = this.createSocket(kernelConnectInfo, 'control') as zmq.Dealer;
    }

    // Types still causing issues here
    public async sendMessage(message: Partial<RawJupyterMessage>, channel: ChannelName): Promise<RawJupyterMessage | undefined> {
        // Encode our message
        const initializedMessage = initializeRawMessage(message);
        const encodedMessage = encodeMessage(initializedMessage, this.connectionInfo.key, this.connectionInfo.signature_scheme);

        switch (channel) {
            case 'control':
                break;
            case 'shell':
                await this.shellSocket.send(encodedMessage);
                const replyFrames = await this.shellSocket.receive();
                const decodedReply = decodeMessage(replyFrames, this.connectionInfo.key, this.connectionInfo.signature_scheme);
                return decodedReply;
                break;
            case 'stdin':
                break;
        }

        return undefined;
    }

    public dispose() {
        if (!this.isDisposed) {
            this.iopubSocket.close();
            this.stdinSocket.close();
            this.shellSocket.close();
            this.controlSocket.close();
        }
    }

    private createSocket(kernelConnectInfo: RawKernelConnectionInfo, channel: ChannelName): zmq.Socket {
        const url = this.formConnectionString(kernelConnectInfo, channel);
        let socket: zmq.Socket;
        switch (channel) {
            case 'iopub':
                const subSocket = new zmq.Subscriber();
                subSocket.connect(url);
                subSocket.subscribe();
                socket = subSocket;
                break;
            case 'stdin':
            case 'shell':
            case 'control':
                const dealerSocket = new zmq.Dealer();
                dealerSocket.connect(url);
                socket = dealerSocket;
                break;
            default:
                throw new Error('Unknown channel in createSocket');
                break;
        }

        return socket;
    }

    private formConnectionString(config: RawKernelConnectionInfo, channel: ChannelName): string {
        const portDelimiter = config.transport === "tcp" ? ":" : "-";
        const port = config[`${channel}_port` as keyof RawKernelConnectionInfo];
        if (!port) {
            throw new Error(`Port not found for channel "${channel}"`);
        }
        return `${config.transport}://${config.ip}${portDelimiter}${port}`;
    };
}