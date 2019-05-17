// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils/lib/json';
import { CancellationTokenSource, Event, EventEmitter } from 'vscode';

import { JupyterKernelPromiseFailedError } from '../../client/datascience/jupyter/jupyterKernelPromiseFailedError';
import { ICell, IJupyterSession } from '../../client/datascience/types';
import { sleep } from '../core';
import { MockJupyterRequest } from './mockJupyterRequest';

const LineFeedRegEx = /(\r\n|\n)/g;

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length
export class MockJupyterSession implements IJupyterSession {
    private dict: Record<string, ICell>;
    private restartedEvent: EventEmitter<void> = new EventEmitter<void>();
    private timedelay: number;
    private executionCount: number = 0;
    private outstandingRequestTokenSources: CancellationTokenSource[] = [];
    private executes: string[] = [];
    private forceRestartTimeout : boolean = false;

    constructor(cellDictionary: Record<string, ICell>, timedelay: number) {
        this.dict = cellDictionary;
        this.timedelay = timedelay;
    }

    public get onRestarted() : Event<void> {
        return this.restartedEvent.event;
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
    public requestExecute(content: KernelMessage.IExecuteRequest, _disposeOnDone?: boolean, _metadata?: JSONObject): Kernel.IFuture {
        // Content should have the code
        const cell = this.findCell(content.code);
        if (cell) {
            this.executes.push(content.code);
        }

        // Create a new dummy request
        this.executionCount += 1;
        const tokenSource = new CancellationTokenSource();
        const request = new MockJupyterRequest(cell, this.timedelay, this.executionCount, tokenSource.token);
        this.outstandingRequestTokenSources.push(tokenSource);

        // When it finishes, it should not be an outstanding request anymore
        const removeHandler = () => {
            this.outstandingRequestTokenSources = this.outstandingRequestTokenSources.filter(f => f !== tokenSource);
        };
        request.done.then(removeHandler).catch(removeHandler);
        return request;
    }

    public requestComplete(_content: KernelMessage.ICompleteRequest): Promise<KernelMessage.ICompleteReplyMsg | undefined> {
        return Promise.resolve({
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
            parent_header: {
            },
            metadata: {
            }
        });
    }

    public dispose(): Promise<void> {
        return sleep(10);
    }

    public getExecutes() : string [] {
        return this.executes;
    }

    private findCell = (code : string) : ICell => {
        // Match skipping line separators
        const withoutLines = code.replace(LineFeedRegEx, '');

        if (this.dict.hasOwnProperty(withoutLines)) {
            return this.dict[withoutLines] as ICell;
        }
        // tslint:disable-next-line:no-console
        console.log(`Cell ${code.splitLines()[1]} not found in mock`);
        throw new Error(`Cell ${code.splitLines()[1]} not found in mock`);
    }
}
