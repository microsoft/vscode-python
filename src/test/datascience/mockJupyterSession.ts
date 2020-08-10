// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils/lib/json';
import { CancellationTokenSource, Event, EventEmitter } from 'vscode';

import { Observable } from 'rxjs/Observable';
import { noop } from '../../client/common/utils/misc';
import { JupyterInvalidKernelError } from '../../client/datascience/jupyter/jupyterInvalidKernelError';
import { JupyterWaitForIdleError } from '../../client/datascience/jupyter/jupyterWaitForIdleError';
import { JupyterKernelPromiseFailedError } from '../../client/datascience/jupyter/kernels/jupyterKernelPromiseFailedError';
import { LiveKernelModel } from '../../client/datascience/jupyter/kernels/types';
import { ICell, IJupyterKernelSpec, IJupyterSession, KernelSocketInformation } from '../../client/datascience/types';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { sleep } from '../core';
import { MockJupyterRequest } from './mockJupyterRequest';

const LineFeedRegEx = /(\r\n|\n)/g;

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length
export class MockJupyterSession implements IJupyterSession {
    public readonly workingDirectory = '';
    public readonly kernelSocket = new Observable<KernelSocketInformation | undefined>();
    private dict: Record<string, ICell>;
    private restartedEvent: EventEmitter<void> = new EventEmitter<void>();
    private onStatusChangedEvent: EventEmitter<ServerStatus> = new EventEmitter<ServerStatus>();
    private timedelay: number;
    private executionCount: number = 0;
    private outstandingRequestTokenSources: CancellationTokenSource[] = [];
    private executes: string[] = [];
    private forceRestartTimeout: boolean = false;
    private completionTimeout: number = 1;
    private lastRequest: MockJupyterRequest | undefined;
    private _status = ServerStatus.Busy;
    constructor(
        cellDictionary: Record<string, ICell>,
        timedelay: number,
        private pendingIdleFailure: boolean = false,
        private pendingKernelChangeFailure: boolean = false
    ) {
        this.dict = cellDictionary;
        this.timedelay = timedelay;
        // Switch to idle after a timeout
        setTimeout(() => this.changeStatus(ServerStatus.Idle), 100);
    }

    public get onRestarted(): Event<void> {
        return this.restartedEvent.event;
    }

    public get onSessionStatusChanged(): Event<ServerStatus> {
        if (!this.onStatusChangedEvent) {
            this.onStatusChangedEvent = new EventEmitter<ServerStatus>();
        }
        return this.onStatusChangedEvent.event;
    }

    public get status(): ServerStatus {
        return this._status;
    }

    public async restart(_timeout: number): Promise<void> {
        // For every outstanding request, switch them to fail mode
        const requests = [...this.outstandingRequestTokenSources];
        requests.forEach((r) => r.cancel());

        if (this.forceRestartTimeout) {
            throw new JupyterKernelPromiseFailedError('Forcing restart timeout');
        }

        return sleep(this.timedelay);
    }
    public interrupt(_timeout: number): Promise<void> {
        const requests = [...this.outstandingRequestTokenSources];
        requests.forEach((r) => r.cancel());
        return sleep(this.timedelay);
    }
    public waitForIdle(_timeout: number): Promise<void> {
        if (this.pendingIdleFailure) {
            this.pendingIdleFailure = false;
            return Promise.reject(new JupyterWaitForIdleError('Kernel is dead'));
        }
        return sleep(this.timedelay);
    }

    public prolongRestarts() {
        this.forceRestartTimeout = true;
    }
    public requestExecute(
        content: KernelMessage.IExecuteRequestMsg['content'],
        _disposeOnDone?: boolean,
        _metadata?: JSONObject
    ): Kernel.IFuture<any, any> {
        // Content should have the code
        const cell = this.findCell(content.code);
        if (cell) {
            this.executes.push(content.code);
        }

        // Create a new dummy request
        this.executionCount += content.store_history && content.code.trim().length > 0 ? 1 : 0;
        const tokenSource = new CancellationTokenSource();
        const request = new MockJupyterRequest(cell, this.timedelay, this.executionCount, tokenSource.token);
        this.outstandingRequestTokenSources.push(tokenSource);

        // When it finishes, it should not be an outstanding request anymore
        const removeHandler = () => {
            this.outstandingRequestTokenSources = this.outstandingRequestTokenSources.filter((f) => f !== tokenSource);
            if (this.lastRequest === request) {
                this.lastRequest = undefined;
            }
        };
        request.done.then(removeHandler).catch(removeHandler);
        this.lastRequest = request;
        return request;
    }

    public requestInspect(
        _content: KernelMessage.IInspectRequestMsg['content']
    ): Promise<KernelMessage.IInspectReplyMsg> {
        return Promise.resolve({
            content: {
                status: 'ok',
                metadata: {},
                found: true,
                data: {} // Could add variable values here?
            },
            channel: 'shell',
            header: {
                date: 'foo',
                version: '1',
                session: '1',
                msg_id: '1',
                msg_type: 'inspect_reply',
                username: 'foo'
            },
            parent_header: {
                date: 'foo',
                version: '1',
                session: '1',
                msg_id: '1',
                msg_type: 'inspect_request',
                username: 'foo'
            },
            metadata: {}
        });
    }

    public sendInputReply(content: string) {
        if (this.lastRequest) {
            this.lastRequest.sendInputReply({ value: content, status: 'ok' });
        }
    }

    public async requestComplete(
        _content: KernelMessage.ICompleteRequestMsg['content']
    ): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        await sleep(this.completionTimeout);

        return {
            content: {
                matches: ['printly', '%%bash'], // This keeps this in the intellisense when the editor pairs down results
                cursor_start: 0,
                cursor_end: 7,
                status: 'ok',
                metadata: {}
            },
            channel: 'shell',
            header: {
                username: 'foo',
                version: '1',
                session: '1',
                msg_id: '1',
                msg_type: 'complete' as any,
                date: ''
            },
            parent_header: {},
            metadata: {}
        } as any;
    }

    public dispose(): Promise<void> {
        return sleep(10);
    }

    public getExecutes(): string[] {
        return this.executes;
    }

    public setCompletionTimeout(timeout: number) {
        this.completionTimeout = timeout;
    }

    public changeKernel(kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        if (this.pendingKernelChangeFailure) {
            this.pendingKernelChangeFailure = false;
            return Promise.reject(new JupyterInvalidKernelError(kernel));
        }
        return Promise.resolve();
    }

    public registerCommTarget(
        _targetName: string,
        _callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
    ) {
        noop();
    }

    public sendCommMessage(
        buffers: (ArrayBuffer | ArrayBufferView)[],
        content: { comm_id: string; data: JSONObject; target_name: string | undefined },
        // tslint:disable-next-line: no-any
        metadata: any,
        // tslint:disable-next-line: no-any
        msgId: any
    ): Kernel.IShellFuture<
        KernelMessage.IShellMessage<'comm_msg'>,
        KernelMessage.IShellMessage<KernelMessage.ShellMessageType>
    > {
        const shellMessage = KernelMessage.createMessage<KernelMessage.ICommMsgMsg<'shell'>>({
            // tslint:disable-next-line: no-any
            msgType: 'comm_msg',
            channel: 'shell',
            buffers,
            content,
            metadata,
            msgId,
            session: '1',
            username: '1'
        });

        return {
            done: Promise.resolve(undefined),
            msg: shellMessage,
            onReply: noop,
            onIOPub: noop,
            onStdin: noop,
            registerMessageHook: noop,
            removeMessageHook: noop,
            sendInputReply: noop,
            isDisposed: false,
            dispose: noop
        };
    }

    public requestCommInfo(
        _content: KernelMessage.ICommInfoRequestMsg['content']
    ): Promise<KernelMessage.ICommInfoReplyMsg> {
        const shellMessage = KernelMessage.createMessage<KernelMessage.ICommInfoReplyMsg>({
            msgType: 'comm_info_reply',
            channel: 'shell',
            content: {
                status: 'ok'
                // tslint:disable-next-line: no-any
            } as any,
            metadata: {},
            session: '1',
            username: '1'
        });

        return Promise.resolve(shellMessage);
    }
    public registerMessageHook(
        _msgId: string,
        _hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        noop();
    }
    public removeMessageHook(
        _msgId: string,
        _hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>
    ): void {
        noop();
    }

    private changeStatus(newStatus: ServerStatus) {
        this._status = newStatus;
        this.onStatusChangedEvent.fire(newStatus);
    }

    private findCell = (code: string): ICell => {
        // Match skipping line separators
        const withoutLines = code.replace(LineFeedRegEx, '').toLowerCase();

        if (this.dict.hasOwnProperty(withoutLines)) {
            return this.dict[withoutLines] as ICell;
        }
        // tslint:disable-next-line:no-console
        console.log(`Cell '${code}' not found in mock`);
        // tslint:disable-next-line:no-console
        console.log(`Dict has these keys ${Object.keys(this.dict).join('","')}`);
        throw new Error(`Cell '${code}' not found in mock`);
    };
}
