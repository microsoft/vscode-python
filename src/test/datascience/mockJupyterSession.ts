// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils/lib/json';
import { CancellationTokenSource, Event, EventEmitter } from 'vscode';

import { JupyterKernelPromiseFailedError } from '../../client/datascience/jupyter/kernels/jupyterKernelPromiseFailedError';
import { LiveKernelModel } from '../../client/datascience/jupyter/kernels/types';
import { ICell, IJupyterKernelSpec, IJupyterSession } from '../../client/datascience/types';
import { ServerStatus } from '../../datascience-ui/interactive-common/mainState';
import { sleep } from '../core';
import { MockJupyterRequest } from './mockJupyterRequest';

const LineFeedRegEx = /(\r\n|\n)/g;

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length
export class MockJupyterSession implements IJupyterSession {
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

    constructor(cellDictionary: Record<string, ICell>, timedelay: number) {
        this.dict = cellDictionary;
        this.timedelay = timedelay;
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
        return ServerStatus.Idle;
    }

    public async restart(_timeout: number): Promise<void> {
        // For every outstanding request, switch them to fail mode
        const requests = [...this.outstandingRequestTokenSources];
        requests.forEach(r => r.cancel());

        if (this.forceRestartTimeout) {
            throw new JupyterKernelPromiseFailedError('Forcing restart timeout');
        }

        return sleep(this.timedelay);
    }
    public interrupt(_timeout: number): Promise<void> {
        const requests = [...this.outstandingRequestTokenSources];
        requests.forEach(r => r.cancel());
        return sleep(this.timedelay);
    }
    public waitForIdle(_timeout: number): Promise<void> {
        return sleep(this.timedelay);
    }

    public prolongRestarts() {
        this.forceRestartTimeout = true;
    }
    public requestExecute(content: KernelMessage.IExecuteRequestMsg['content'], _disposeOnDone?: boolean, _metadata?: JSONObject): Kernel.IFuture<any, any> {
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
            this.outstandingRequestTokenSources = this.outstandingRequestTokenSources.filter(f => f !== tokenSource);
            if (this.lastRequest === request) {
                this.lastRequest = undefined;
            }
        };
        request.done.then(removeHandler).catch(removeHandler);
        this.lastRequest = request;
        return request;
    }

    public requestInspect(_content: KernelMessage.IInspectRequestMsg['content']): Promise<KernelMessage.IInspectReplyMsg> {
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

    public async requestComplete(_content: KernelMessage.ICompleteRequestMsg['content']): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        await sleep(this.completionTimeout);

        return {
            content: {
                matches: ['printly'], // This keeps this in the intellisense when the editor pairs down results
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
                msg_type: 'complete'
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

    public changeKernel(_kernel: IJupyterKernelSpec | LiveKernelModel, _timeoutMS: number): Promise<void> {
        return Promise.resolve();
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
