// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { AsyncFunction, RetryCounterOptions, RetryOptions, RetryTimeoutOptions } from './types';

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
export async function retryWrapper(this: {} | any, options: RetryOptions, fn: AsyncFunction, ...args: {}[]): Promise<{}> {
    const watch = new StopWatch();
    const interval = options.interval || 100;
    const iterations = (options as RetryTimeoutOptions).timeout ?
        ((options as RetryTimeoutOptions).timeout / interval) :
        (options as RetryCounterOptions).count;
    const timeout = (options as RetryTimeoutOptions).timeout || ((options as RetryCounterOptions).count * interval);

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
    console.error(`Timeout after ${timeout}, with options ${JSON.stringify(options)}`, lastEx);
    throw lastEx;
}

export function retry(options: RetryOptions = { timeout: 5_000, interval: 100 }) {
    // tslint:disable-next-line: no-any no-function-expression
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value!;
        descriptor.value = async function (this: {}): Promise<{}> {
            const args = [].slice.call(arguments) as {}[];
            return retryWrapper.bind(this)(options, originalMethod as AsyncFunction, ...args);
        };

        return descriptor;
    };
}
