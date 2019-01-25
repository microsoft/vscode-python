// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@phosphor/coreutils/lib/json';
import { CancellationTokenSource, Event, EventEmitter } from 'vscode';

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

    constructor(cellDictionary: Record<string, ICell>, timedelay: number) {
        this.dict = cellDictionary;
        this.timedelay = timedelay;
    }

    public get onRestarted() : Event<void> {
        return this.restartedEvent.event;
    }

    public async restart(): Promise<void> {
        // For every outstanding request, switch them to fail mode
        const requests = [...this.outstandingRequestTokenSources];
        requests.forEach(r => r.cancel());
        return sleep(this.timedelay);
    }
    public interrupt(): Promise<void> {
        const requests = [...this.outstandingRequestTokenSources];
        requests.forEach(r => r.cancel());
        return sleep(this.timedelay);
    }
    public waitForIdle(): Promise<void> {
        return sleep(this.timedelay);
    }
    public requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean, metadata?: JSONObject): Kernel.IFuture {
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

    public async dispose(): Promise<void> {
        await sleep(10);
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
        console.log(`Cell ${code.splitLines()[0]} not found in mock`);
        throw new Error(`Cell ${code.splitLines()[0]} not found in mock`);
    }
}
