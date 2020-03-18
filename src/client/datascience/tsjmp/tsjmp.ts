import * as zmq from 'zeromq';

export interface RawKernelConnectionInfo {
    version: number;
    iopub_port: number;
    shell_port: number;
    stdin_port: number;
    control_port: number;
    signature_scheme: "hmac-sha256";
    hb_port: number;
    ip: string;
    key: string;
    transport: "tcp" | "ipc";
}

type ChannelName = "iopub" | "stdin" | "shell" | "control";

export class RawKernelConnection {
    // Our sockets that we will connect to
    private iopubSocket: zmq.Subscriber;
    private stdinSocket: zmq.Dealer;
    private shellSocket: zmq.Dealer;
    private controlSocket: zmq.Dealer;

    constructor(kernelConnectInfo: RawKernelConnectionInfo) {

    }

    private async createSocket(kernelConnectInfo: RawKernelConnectionInfo, channel: ChannelName): Promise<zmq.Socket> {
        // IANHU: identity / scheme?
        // const scheme = kernelConnectInfo.signature_scheme.slice("hmac-".length);
        const url = this.formConnectionString(kernelConnectInfo, channel);
        let socket: zmq.Socket;
        switch (channel) {
            case 'iopub':
                const subSocket = new zmq.Subscriber();
                // IANHU: Connect or bind here?
                subSocket.connect(url);
                subSocket.subscribe();
                socket = subSocket;
                break;
            case 'stdin':
            case 'shell':
            case 'control':
                const dealerSocket = new zmq.Dealer();
                await dealerSocket.bind(url);
                socket = dealerSocket;
                break;
            default:
                return Promise.reject(new Error('Unknown Channel Type'));
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