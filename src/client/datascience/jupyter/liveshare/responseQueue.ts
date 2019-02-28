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
    private responseQueue : IServerResponse [] = [];
    private waitingQueue : { deferred: Deferred<IServerResponse>; predicate(r: IServerResponse) : boolean }[] = [];

    public waitForObservable(code: string, file: string, line: number, id: string) : Observable<ICell[]> {
        // Create a wrapper observable around the actual server
        return new Observable<ICell[]>(subscriber => {
            // Wait for the observable responses to come in
            this.waitForResponses(subscriber, code, file, line, id)
                .catch(e => {
                    subscriber.error(e);
                    subscriber.complete();
                });
        });
    }

    public push(response: IServerResponse) {
        this.responseQueue.push(response);
        this.dispatchResponses();
    }

    public send(service: vsls.SharedService) {
        this.responseQueue.forEach(r => service.notify(LiveShareCommands.serverResponse, r));
    }

    public clear() {
        this.responseQueue = [];
    }

    private async waitForResponses(subscriber: Subscriber<ICell[]>, code: string, file: string, line: number, id: string) : Promise<void> {
        let pos = 0;
        let foundId = id;
        let cells: ICell[] | undefined = [];
        while (cells !== undefined) {
            // Find all matches in order
            const response = await this.waitForSpecificResponse<IExecuteObservableResponse>(r => {
                return (r.pos === pos) &&
                    (foundId === r.id || !foundId) &&
                    (code === r.code) &&
                    (!r.cells || (r.cells && r.cells[0].file === file && r.cells[0].line === line));
            });
            if (response.cells) {
                subscriber.next(response.cells);
                pos += 1;
                foundId = response.id;
            }
            cells = response.cells;
        }
        subscriber.complete();
    }

    private waitForSpecificResponse<T extends IServerResponse>(predicate: (response: T) => boolean) : Promise<T> {
        // See if we have any responses right now with this type
        const index = this.responseQueue.findIndex(r => predicate(r as T));
        if (index >= 0) {
            // Pull off the match
            const match = this.responseQueue[index];

            // Remove from the response queue every response before this one as we're not going
            // to be asking for them anymore. (they should be old requests)
            this.responseQueue = this.responseQueue.length > index + 1 ? this.responseQueue.slice(index + 1) : [];

            // Return this single item
            return Promise.resolve(match as T);
        } else {
            // We have to wait for a new input to happen
            const waitable = { deferred: createDeferred<T>(), predicate };
            this.waitingQueue.push(waitable);
            return waitable.deferred.promise;
        }
    }

    private dispatchResponses() {
        // Look through all of our responses that are queued up and see if they make a
        // waiting promise resolve
        for (let i = 0; i < this.responseQueue.length; i += 1) {
            const response = this.responseQueue[i];
            const matchIndex = this.waitingQueue.findIndex(w => w.predicate(response));
            if (matchIndex >= 0) {
                this.waitingQueue[matchIndex].deferred.resolve(response);
                this.waitingQueue.splice(matchIndex, 1);
                this.responseQueue.splice(i, 1);
                i -= 1; // Offset the addition as we removed this item
            }
        }
    }
}
