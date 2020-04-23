import type { KernelMessage } from '@jupyterlab/services';
import * as WebSocketWS from 'ws';
import { traceError } from '../../common/logger';
import { noop } from '../../common/utils/misc';
import { IWebSocketLike } from '../kernelSocketWrapper';
import { IJMPConnection } from '../types';

// tslint:disable: no-any
// This class mimics a websocket but talks to a jmp connection instead of a tcp/ip connection.
export class RawSocket implements IWebSocketLike {
    public onopen: (event: { target: any }) => void = noop;
    public onerror: (event: { error: any; message: string; type: string; target: any }) => void = noop;
    public onclose: (event: { wasClean: boolean; code: number; reason: string; target: any }) => void = noop;
    public onmessage: (event: { data: WebSocketWS.Data; type: string; target: any }) => void = noop;
    private serialize: (msg: KernelMessage.IMessage) => string | ArrayBuffer;
    private deserialize: (data: ArrayBuffer | string) => KernelMessage.IMessage;
    constructor(private jmpConnection: IJMPConnection, _clientId: string) {
        this.jmpConnection.subscribe(this.onIncomingMessage.bind(this), this.onCommError.bind(this));
        // tslint:disable-next-line: no-require-imports
        const jupyterLabSerialize = require('@jupyterlab/services/lib/kernel/serialize') as typeof import('@jupyterlab/services/lib/kernel/serialize'); // NOSONAR
        this.serialize = jupyterLabSerialize.serialize;
        this.deserialize = jupyterLabSerialize.deserialize;
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
    public send(data: any, _a2: any): void {
        this.jmpConnection.sendMessage(data);
    }

    private onIncomingMessage(message: KernelMessage.IMessage<KernelMessage.MessageType>) {
        try {
            this.emit('message', message);
        } catch (exc) {
            this.onCommError(exc);
        }
    }

    private onCommError(exc: any) {
        traceError(`Error communicating with kernel:`, exc);
    }
}
