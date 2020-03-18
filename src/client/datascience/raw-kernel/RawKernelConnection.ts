import { wireProtocol } from '@nteract/messaging';
//import { KernelMessage } from '@jupyterlab/services';
import * as zmq from 'zeromq';
import { IDisposable } from '../../common/types';

export interface IRawKernelConnectionInfo {
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

interface IRawJupyterMessageHeader {
    msg_id: string;
    username: string;
    date: string;
    msg_type: string;
    version: string;
    session: string;
}

interface IRawJupyterMessage {
    header: IRawJupyterMessageHeader | {};
    parent_header: IRawJupyterMessageHeader | {};
    metadata: object;
    content: object;
    // tslint:disable-next-line:array-type prefer-array-literal
    buffers: Array<Buffer>;
    // tslint:disable-next-line:array-type prefer-array-literal
    idents: Array<Buffer>;
}

export type ChannelName = 'iopub' | 'stdin' | 'shell' | 'control';

// RAWKERNEL: Encode / decode moved to a service behind interface?
// RAWKERNEL: Types for message classes? Don't like the any here
function encodeMessage(message: IRawJupyterMessage, key: string | undefined, scheme: string | undefined): Buffer[] {
    // tslint:disable-next-line:no-any
    return wireProtocol.encode(message as any, key, scheme);
}

function decodeMessage(frames: Buffer[], key: string | undefined, scheme: string | undefined): IRawJupyterMessage {
    // tslint:disable-next-line:no-any
    return wireProtocol.decode(frames, key, scheme) as any;
}

// Fill out any missing defaults from the input message
function initializeRawMessage(message: Partial<IRawJupyterMessage>): IRawJupyterMessage {
    return {
        header: {},
        parent_header: {},
        metadata: {},
        content: {},
        idents: [],
        buffers: [],
        ...message
    };
}

export class RawKernelConnection implements IDisposable {
    public isDisposed = false;
    // Our sockets that we will connect to
    private iopubSocket: zmq.Subscriber;
    private stdinSocket: zmq.Dealer;
    private shellSocket: zmq.Dealer;
    private controlSocket: zmq.Dealer;
    private connectionInfo: IRawKernelConnectionInfo;

    constructor(kernelConnectInfo: IRawKernelConnectionInfo) {
        this.connectionInfo = kernelConnectInfo;

        // Clean this up. Promise all?
        this.iopubSocket = this.createSocket(kernelConnectInfo, 'iopub') as zmq.Subscriber;
        this.stdinSocket = this.createSocket(kernelConnectInfo, 'stdin') as zmq.Dealer;
        this.shellSocket = this.createSocket(kernelConnectInfo, 'shell') as zmq.Dealer;
        this.controlSocket = this.createSocket(kernelConnectInfo, 'control') as zmq.Dealer;
    }

    // Types still causing issues here
    public async sendMessage(
        message: Partial<IRawJupyterMessage>,
        channel: ChannelName
    ): Promise<IRawJupyterMessage | undefined> {
        // Encode our message
        const initializedMessage = initializeRawMessage(message);
        const encodedMessage = encodeMessage(
            initializedMessage,
            this.connectionInfo.key,
            this.connectionInfo.signature_scheme
        );

        switch (channel) {
            case 'control':
                break;
            case 'shell':
                await this.shellSocket.send(encodedMessage);
                const replyFrames = await this.shellSocket.receive();
                const decodedReply = decodeMessage(
                    replyFrames,
                    this.connectionInfo.key,
                    this.connectionInfo.signature_scheme
                );
                return decodedReply;
                break;
            case 'stdin':
                break;
            default:
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

    private createSocket(kernelConnectInfo: IRawKernelConnectionInfo, channel: ChannelName): zmq.Socket {
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

    private formConnectionString(config: IRawKernelConnectionInfo, channel: ChannelName): string {
        const portDelimiter = config.transport === 'tcp' ? ':' : '-';
        const port = config[`${channel}_port` as keyof IRawKernelConnectionInfo];
        if (!port) {
            throw new Error(`Port not found for channel "${channel}"`);
        }
        return `${config.transport}://${config.ip}${portDelimiter}${port}`;
    }
}
