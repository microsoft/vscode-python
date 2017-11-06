"use strict";

import { EventEmitter } from "events";
import * as Rx from 'rx';
import { OutputChannel } from 'vscode';
import { ParsedIOMessage } from '../contracts';
import { Helpers } from '../common/helpers';
type KernelMessage = any;


export class MessageParser extends EventEmitter {
    private isDebugging: boolean;
    constructor(private outputChannel: OutputChannel) {
        super();
        this.isDebugging = process.env['DEBUG_EXTENSION_IPYTHON'] === '1';
    }
    private writeToDebugLog(message: string) {
        if (!this.isDebugging) {
            return;
        }
        this.outputChannel.appendLine(message);
    }
    public processResponse(message: KernelMessage, observer?: Rx.Observer<ParsedIOMessage>) {
        if (!message) {
            return;
        }
        if (!Helpers.isValidMessag(message)) {
            return;
        }
        try {
            const msg_type = message.header.msg_type;
            if (msg_type === 'status') {
                this.writeToDebugLog(`Kernel Status = ${(message.content as any).execution_state}`);
                this.emit('status', (message.content as any).execution_state);
            }
            const msg_id = (message.parent_header as any).msg_id;
            if (!msg_id) {
                return;
            }
            const status = (message.content as any).status;
            let parsedMesage: ParsedIOMessage;
            switch (status) {
                case 'abort':
                case 'aborted':
                case 'error': {
                    // http://jupyter-client.readthedocs.io/en/latest/messaging.html#request-reply
                    if (msg_type !== 'complete_reply' && msg_type !== 'inspect_reply') {
                        parsedMesage = {
                            data: 'error',
                            type: 'text',
                            stream: 'status'
                        };
                    }
                    break;
                }
                case 'ok': {
                    // http://jupyter-client.readthedocs.io/en/latest/messaging.html#request-reply
                    if (msg_type !== 'complete_reply' && msg_type !== 'inspect_reply') {
                        parsedMesage = {
                            data: 'ok',
                            type: 'text',
                            stream: 'status'
                        };
                    }
                }
            }
            this.writeToDebugLog(`Shell Result with msg_id = ${msg_id} with status = ${status}`);
            if (!parsedMesage) {
                parsedMesage = Helpers.parseIOMessage(message);
            }
            if (!parsedMesage || !observer) {
                return;
            }
            this.writeToDebugLog(`Shell Result with msg_id = ${msg_id} has message of: '\n${JSON.stringify(message)}`);
            observer.onNext(parsedMesage);
        }
        catch (ex) {
            this.emit('shellmessagepareerror', ex, JSON.stringify(message));
        }
    }
}
