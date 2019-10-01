// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CancellationToken } from 'vscode';

import { createDeferred } from './utils/async';
import * as localize from './utils/localize';

/**
 * Error type thrown when canceling.
 */
export class CancellationError extends Error {
    constructor() {
        super(localize.Common.canceled());
    }
}
/**
 * Create a promise that will either resolve with a default value or reject when the token is cancelled.
 *
 * @export
 * @template T
 * @param {({ defaultValue: T; token: CancellationToken; cancelAction: 'reject' | 'resolve' })} options
 * @returns {Promise<T>}
 */
export function createPromiseFromCancellation<T>(options: { defaultValue: T; token?: CancellationToken; cancelAction: 'reject' | 'resolve' }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        // Never resolve.
        if (!options.token) {
            return;
        }
        const complete = () => {
            if (options.token!.isCancellationRequested) {
                if (options.cancelAction === 'resolve') {
                    return resolve(options.defaultValue);
                }
                if (options.cancelAction === 'reject') {
                    return reject(new CancellationError());
                }
            }
        };

        options.token.onCancellationRequested(complete);
    });
}

export namespace Cancellation {
    /**
     * Races a promise and cancellation. Promise can take a cancellation token too in order to listen to cancellation.
     * @param work function returning a promise to race
     * @param token token used for cancellation
     */
    export function race<T>(work: (token?: CancellationToken) => Promise<T>, token?: CancellationToken): Promise<T> {
        if (token) {
            // Use a deferred promise. Resolves when the work finishes
            const deferred = createDeferred<T>();

            // Cancel the deferred promise when the cancellation happens
            token.onCancellationRequested(() => {
                if (!deferred.completed) {
                    deferred.reject(new CancellationError());
                }
            });

            // Might already be canceled
            if (token.isCancellationRequested) {
                // Just start out as rejected
                deferred.reject(new CancellationError());
            } else {
                // Not canceled yet. When the work finishes
                // either resolve our promise or cancel.
                work(token)
                    .then(v => {
                        if (!deferred.completed) {
                            deferred.resolve(v);
                        }
                    })
                    .catch(e => {
                        if (!deferred.completed) {
                            deferred.reject(e);
                        }
                    });
            }

            return deferred.promise;
        } else {
            // No actual token, just do the original work.
            return work();
        }
    }

    /**
     * isCanceled returns a boolean indicating if the cancel token has been canceled.
     * @param cancelToken
     */
    export function isCanceled(cancelToken?: CancellationToken): boolean {
        return cancelToken ? cancelToken.isCancellationRequested : false;
    }

    /**
     * throws a CancellationError if the token is canceled.
     * @param cancelToken
     */
    export function throwIfCanceled(cancelToken?: CancellationToken): void {
        if (isCanceled(cancelToken)) {
            throw new CancellationError();
        }
    }
}
