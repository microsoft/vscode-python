// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode-jsonrpc';
import * as localize from './utils/localize';

/**
 * Error type thrown when canceling.
 */
export class CancellationError extends Error {

    constructor() {
        super(localize.Common.canceled());
    }
}

export namespace Cancellation {

    /**
     * Races a promise and cancellation. Promise can take a cancellation token too in order to listen to cancellation.
     * @param work function returning a promise to race
     * @param token token used for cancellation
     */
    export function race<T>(work : (token?: CancellationToken) => Promise<T>, token?: CancellationToken) : Promise<T> {
        if (token) {
            // Race rejection. This allows the callback to run because the second promise
            // will be in the promise queue.
            return Promise.race([work(token), new Promise<T>((resolve, reject) => {
                token.onCancellationRequested(() => reject(new CancellationError()));
            })]);
        } else {
            // No actual token, just do the original work.
            return work();
        }
    }

    /**
     * isCanceled returns a boolean indicating if the cancel token has been canceled.
     * @param cancelToken
     */
    export function isCanceled(cancelToken?: CancellationToken) : boolean {
        return cancelToken ? cancelToken.isCancellationRequested : false;
    }

    /**
     * throws a CancellationError if the token is canceled.
     * @param cancelToken
     */
    export function throwIfCanceled(cancelToken?: CancellationToken) : void {
        if (isCanceled(cancelToken)) {
            throw new CancellationError();
        }
    }

}
