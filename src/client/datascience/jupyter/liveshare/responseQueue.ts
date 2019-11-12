// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as vsls from 'vsls/vscode';

import { createDeferred, Deferred } from '../../../common/utils/async';
import { LiveShareCommands } from '../../constants';
import { ICell } from '../../types';
import { IExecuteObservableResponse, IServerResponse } from './types';

export class ResponseQueue {
    private responseQueue: IServerResponse[] = [];
    private waitingQueue: { deferred: Deferred<IServerResponse>; predicate(r: IServerResponse): boolean }[] = [];

    public waitForObservable(code: string, id: string): Observable<ICell[]> {
        // Create a wrapper observable around the actual server
        return new Observable<ICell[]>(subscriber => {
            // Wait for the observable responses to come in
            this.waitForResponses(subscriber, code, id).catch(e => {
                subscriber.error(e);
                subscriber.complete();
            });
        });
    }

    public push(response: IServerResponse) {
        this.responseQueue.push(response);
        this.dispatchResponse(response);
    }

    public send(service: vsls.SharedService, translator: (r: IServerResponse) => IServerResponse) {
        this.responseQueue.forEach(r => service.notify(LiveShareCommands.serverResponse, translator(r)));
    }

    public clear() {
        this.responseQueue = [];
    }

    private async waitForResponses(subscriber: Subscriber<ICell[]>, code: string, id: string): Promise<void> {
        let pos = 0;
        let cells: ICell[] | undefined = [];
        while (cells !== undefined) {
            // Find all matches in order
            const response = await this.waitForSpecificResponse<IExecuteObservableResponse>(r => {
                return r.pos === pos && id === r.id && code === r.code;
            });
            if (response.cells) {
                subscriber.next(response.cells);
                pos += 1;
            }
            cells = response.cells;
        }
        subscriber.complete();

        // Clear responses after we respond to the subscriber.
        this.responseQueue = this.responseQueue.filter(r => {
            const er = r as IExecuteObservableResponse;
            return er.id !== id;
        });
    }

    private waitForSpecificResponse<T extends IServerResponse>(predicate: (response: T) => boolean): Promise<T> {
        // See if we have any responses right now with this type
        const index = this.responseQueue.findIndex(r => predicate(r as T));
        if (index >= 0) {
            // Pull off the match
            const match = this.responseQueue[index];

            // Return this single item
            return Promise.resolve(match as T);
        } else {
            // We have to wait for a new input to happen
            const waitable = { deferred: createDeferred<T>(), predicate };
            this.waitingQueue.push(waitable);
            return waitable.deferred.promise;
        }
    }

    private dispatchResponse(response: IServerResponse) {
        // Look through all of our responses that are queued up and see if they make a
        // waiting promise resolve
        const matchIndex = this.waitingQueue.findIndex(w => w.predicate(response));
        if (matchIndex >= 0) {
            this.waitingQueue[matchIndex].deferred.resolve(response);
            this.waitingQueue.splice(matchIndex, 1);
        }
    }
}
