// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { warn } from './logger';
import { RetryCounterOptions, RetryOptions, RetryTimeoutOptions } from './types';

export enum OSType {
    OSX = 'OSX',
    Linux = 'Linux',
    Windows = 'Windows'
}

export function getOSType(): OSType {
    if (/^win/.test(process.platform)) {
        return OSType.Windows;
    } else if (/^darwin/.test(process.platform)) {
        return OSType.OSX;
    } else if (/^linux/.test(process.platform)) {
        return OSType.Linux;
    } else {
        throw new Error('Unknown OS');
    }
}

export function sleep(timeout: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

export function noop() {
    // Do nothing.
}

export class StopWatch {
    private started = new Date().getTime();
    public get elapsedTime() {
        return new Date().getTime() - this.started;
    }
    public reset() {
        this.started = new Date().getTime();
    }
    public log(message: string): void {
        // tslint:disable-next-line: no-console
        console.log(`${this.elapsedTime}: ${message}`);
    }
}

// tslint:disable-next-line: no-any
type AnyAsyncFunction = (...args: any[]) => Promise<any>;
type Unpacked<T> = T extends Promise<infer U> ? U : T;
// tslint:disable-next-line: no-any
/**
 * Wrap a function to ensure it gets retried if there are any errors.
 * @example The following example will run the inner function for a max of 10ms (will fail after 10ms as it will always throw an exception).
 * retryWrapper(async ()=> { console.log('Hello'); throw new Error('kaboom');}, {timeout: 10});
 *
 * @export
 * @template T
 * @param {({} | any)} this
 * @param {RetryOptions} options
 * @param {T} fn
 * @param {...{}[]} args
 * @returns {Promise<Unpacked<ReturnType<T>>>}
 */
export async function retryWrapper<T extends AnyAsyncFunction>(
    // tslint:disable-next-line: no-any
    this: {} | any,
    options: RetryOptions,
    fn: T,
    ...args: {}[]
): Promise<Unpacked<ReturnType<T>>> {
    const watch = new StopWatch();
    const interval = options.interval || 100;
    const iterations = (options as RetryTimeoutOptions).timeout ? (options as RetryTimeoutOptions).timeout / interval : (options as RetryCounterOptions).count;
    const timeout = (options as RetryTimeoutOptions).timeout || (options as RetryCounterOptions).count * interval;

    let lastEx: Error | undefined;

    // tslint:disable-next-line: prefer-array-literal
    for (const _ of [...new Array(iterations)]) {
        try {
            return await (fn as Function).apply(this, args);
        } catch (ex) {
            lastEx = ex;
            if (watch.elapsedTime > timeout) {
                break;
            }
            await sleep(interval);
            continue;
        }
    }
    if (options.logFailures !== false) {
        const customMessage = options.errorMessage ? `, ${options.errorMessage}` : '';
        warn(`Timeout after ${timeout}${customMessage}. Options ${JSON.stringify(options)}`, lastEx);
    }
    throw lastEx;
}

/**
 * Retry decorator.
 *
 * @export
 * @param {RetryOptions} [options={ timeout: 5_000, interval: 100 }]
 * @returns
 */
export function retry(options: RetryOptions = { timeout: 5_000, interval: 100 }) {
    // tslint:disable-next-line: no-any no-function-expression
    return function(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value!;
        descriptor.value = async function(this: {}): Promise<{}> {
            const args = [].slice.call(arguments) as {}[];
            return retryWrapper.bind(this)(options, originalMethod as AnyAsyncFunction, ...args);
        };

        return descriptor;
    };
}
