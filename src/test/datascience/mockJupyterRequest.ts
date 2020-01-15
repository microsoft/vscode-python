// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { CancellationToken } from 'vscode-jsonrpc';

import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { ICell } from '../../client/datascience/types';
import { concatMultilineStringInput } from '../../datascience-ui/common';

//tslint:disable:no-any
interface IMessageResult {
    message: KernelMessage.IIOPubMessage | KernelMessage.IInputRequestMsg | KernelMessage.IMessage;
    haveMore: boolean;
}

interface IMessageProducer {
    produceNextMessage(): Promise<IMessageResult>;
    receiveInput(value: string): void;
}

class SimpleMessageProducer implements IMessageProducer {
    private type: KernelMessage.IOPubMessageType;
    private result: any;
    private channel: string = 'iopub';

    constructor(type: KernelMessage.IOPubMessageType, result: any, channel: string = 'iopub') {
        this.type = type;
        this.result = result;
        this.channel = channel;
    }

    public produceNextMessage(): Promise<IMessageResult> {
        return new Promise<IMessageResult>((resolve, _reject) => {
            const message = this.generateMessage(this.type, this.result, this.channel);
            resolve({ message: message, haveMore: false });
        });
    }

    public receiveInput(_value: string): void {
        noop();
    }

    protected generateMessage(msgType: KernelMessage.IOPubMessageType, result: any, _channel: string = 'iopub'): KernelMessage.IIOPubMessage {
        return {
            channel: 'iopub',
            header: {
                username: 'foo',
                version: '1.1',
                session: '1111111111',
                msg_id: '1.1',
                msg_type: msgType,
                date: ''
            },
            parent_header: {},
            metadata: {},
            content: result
        };
    }

    protected generateInputMessage(): KernelMessage.IInputRequestMsg {
        return {
            channel: 'stdin',
            header: {
                username: 'foo',
                version: '1.1',
                session: '1111111111',
                msg_id: '1.1',
                msg_type: 'stdin' as any,
                date: ''
            },
            parent_header: {},
            metadata: {},
            content: {
                prompt: 'Type Something',
                password: false
            }
        };
    }

    protected generateClearMessage(wait: boolean): KernelMessage.IClearOutputMsg {
        return {
            channel: 'iopub',
            header: {
                username: 'foo',
                version: '1.1',
                session: '1111111111',
                msg_id: '1.1',
                msg_type: 'clear_output',
                date: ''
            },
            parent_header: {},
            metadata: {},
            content: {
                wait
            }
        };
    }
}

class OutputMessageProducer extends SimpleMessageProducer {
    private output: nbformat.IOutput;
    private cancelToken: CancellationToken;
    private waitingForInput: Deferred<string> | undefined;

    constructor(output: nbformat.IOutput, cancelToken: CancellationToken) {
        super(output.output_type as KernelMessage.IOPubMessageType, output);
        this.output = output;
        this.cancelToken = cancelToken;
    }

    public async produceNextMessage(): Promise<IMessageResult> {
        // Special case the 'generator' cell that returns a function
        // to generate output.
        if (this.output.output_type === 'generator') {
            const resultEntry = <any>this.output.resultGenerator;
            const resultGenerator = resultEntry as (t: CancellationToken) => Promise<{ result: nbformat.IStream; haveMore: boolean }>;
            if (resultGenerator) {
                const streamResult = await resultGenerator(this.cancelToken);
                return {
                    message: this.generateMessage(streamResult.result.output_type, streamResult.result),
                    haveMore: streamResult.haveMore
                };
            }
        } else if (this.output.output_type === 'input') {
            if (this.waitingForInput) {
                await this.waitingForInput.promise;
                this.waitingForInput = undefined;
                return {
                    message: this.generateDummyMessage(),
                    haveMore: false
                };
            } else {
                this.waitingForInput = createDeferred<string>();
                return {
                    message: this.generateInputMessage(),
                    haveMore: this.waitingForInput !== undefined
                };
            }
        } else if (this.output.output_type === 'clear_true') {
            // Generate a clear message
            return {
                message: this.generateClearMessage(true),
                haveMore: false
            };
        }

        return super.produceNextMessage();
    }

    public receiveInput(value: string) {
        if (this.waitingForInput) {
            this.waitingForInput.resolve(value);
        }
    }

    private generateDummyMessage(): KernelMessage.IMessage {
        return {
            channel: 'shell',
            header: {
                username: 'foo',
                version: '1.1',
                session: '1111111111',
                msg_id: '1.1',
                msg_type: 'stdin' as any
            },
            parent_header: {},
            metadata: {},
            content: {}
        } as any;
    }
}

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length
export class MockJupyterRequest implements Kernel.IFuture<any, any> {
    public msg: KernelMessage.IShellMessage;
    public onReply: (msg: KernelMessage.IShellMessage) => void | PromiseLike<void>;
    public onStdin: (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void>;
    public onIOPub: (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void>;
    public isDisposed: boolean = false;

    private deferred: Deferred<KernelMessage.IShellMessage> = createDeferred<KernelMessage.IShellMessage>();
    private executionCount: number;
    private cell: ICell;
    private cancelToken: CancellationToken;
    private currentProducer: IMessageProducer | undefined;

    constructor(cell: ICell, delay: number, executionCount: number, cancelToken: CancellationToken) {
        // Save our execution count, this is like our id
        this.executionCount = executionCount;
        this.cell = cell;
        this.cancelToken = cancelToken;

        // Because the base type was implemented without undefined on unset items, we
        // need to set all items for hygiene to work.
        this.msg = {
            channel: 'shell',
            header: {
                username: 'foo',
                version: '1.1',
                session: '1111111111',
                msg_id: '1.1',
                msg_type: ('shell' as any) as KernelMessage.ShellMessageType,
                date: ''
            },
            parent_header: {},
            metadata: {},
            content: {}
        };
        this.onIOPub = noop;
        this.onReply = noop;
        this.onStdin = noop;

        // Start our sequence of events that is our cell running
        this.executeRequest(delay);
    }

    public get done(): Promise<KernelMessage.IShellMessage> {
        return this.deferred.promise;
    }
    public registerMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        noop();
    }
    public removeMessageHook(_hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
        noop();
    }
    public sendInputReply(content: KernelMessage.IInputReply): void {
        if (this.currentProducer) {
            this.currentProducer.receiveInput(content.value);
        }
    }
    public dispose(): void {
        if (!this.isDisposed) {
            this.isDisposed = true;
        }
    }

    private executeRequest(delay: number) {
        // The order of messages should be:
        // 1 - Status busy
        // 2 - Execute input
        // 3 - N - Results/output
        // N + 1 - Status idle

        // Create message producers for output first.
        const outputs = this.cell.data.outputs as nbformat.IOutput[];
        const outputProducers = outputs.map(o => new OutputMessageProducer({ ...o, execution_count: this.executionCount }, this.cancelToken));

        // Then combine those into an array of producers for the rest of the messages
        const producers = [
            new SimpleMessageProducer('status', { execution_state: 'busy' }),
            new SimpleMessageProducer('execute_input', { code: concatMultilineStringInput(this.cell.data.source), execution_count: this.executionCount }),
            ...outputProducers,
            new SimpleMessageProducer('status', { execution_state: 'idle' })
        ];

        // Then send these until we're done
        this.sendMessages(producers, delay);
    }

    private sendMessages(producers: IMessageProducer[], delay: number) {
        if (producers && producers.length > 0) {
            // We have another producer, after a delay produce the next
            // message
            const producer = producers[0];
            this.currentProducer = producer;
            setTimeout(() => {
                // Produce the next message
                producer
                    .produceNextMessage()
                    .then(r => {
                        // If there's a message, send it.
                        if (r.message && r.message.channel === 'iopub' && this.onIOPub) {
                            this.onIOPub(r.message as KernelMessage.IIOPubMessage);
                        } else if (r.message && r.message.channel === 'stdin' && this.onStdin) {
                            this.onStdin(r.message as KernelMessage.IStdinMessage);
                        }

                        // Move onto the next producer if allowed
                        if (!this.cancelToken.isCancellationRequested) {
                            if (r.haveMore) {
                                this.sendMessages(producers, delay);
                            } else {
                                this.sendMessages(producers.slice(1), delay);
                            }
                        }
                    })
                    .ignoreErrors();
            }, delay);
        } else {
            this.currentProducer = undefined;
            // No more messages, create a simple producer for our shell message
            const shellProducer = new SimpleMessageProducer('done' as any, { status: 'success' }, 'shell');
            shellProducer
                .produceNextMessage()
                .then(r => {
                    this.deferred.resolve((<any>r.message) as KernelMessage.IShellMessage);
                })
                .ignoreErrors();
        }
    }
}
