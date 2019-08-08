// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export type RetryTimeoutOptions = {
    /**
     * Number of times to try.
     *
     * @type {number}
     */
    timeout: number;
    /**
     * Time in ms to wait before retrying (generally defaults to 100ms).
     *
     * @type {number}
     */
    interval?: number;
    errorMessage?: string;
    /**
     * If true, then do not log failures.
     * Defaults to true.
     *
     * @type {boolean}
     */
    logFailures?: boolean;
};
export type RetryCounterOptions = {
    /**
     * Number of times to try.
     *
     * @type {number}
     */
    count: number;
    /**
     * Time in ms to wait before retrying (generally defaults to 100ms).
     *
     * @type {number}
     */
    interval?: number;
    errorMessage?: string;
    /**
     * If true, then do not log failures.
     * Defaults to true.
     *
     * @type {boolean}
     */
    logFailures?: boolean;
};
export type RetryOptions = RetryTimeoutOptions | RetryCounterOptions;
