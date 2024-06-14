// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Event } from 'vscode';
import { IDisposable } from '../types';
import { EmptyDisposable } from './resourceLifecycle';

/**
 * Given an event, returns another event which only fires once.
 */
export function once<T>(event: Event<T>): Event<T> {
    return (listener, thisArgs = null, disposables?) => {
        // we need this, in case the event fires during the listener call
        let didFire = false;
        let result: IDisposable | undefined;
        // eslint-disable-next-line prefer-const
        result = event(
            (e) => {
                if (didFire) {
                    return;
                }
                if (result) {
                    result.dispose();
                } else {
                    didFire = true;
                }

                // eslint-disable-next-line consistent-return
                return listener.call(thisArgs, e);
            },
            null,
            disposables,
        );

        if (didFire) {
            result.dispose();
        }

        return result;
    };
}

/**
 * Creates a promise out of an event, using the once helper.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPromise<T>(event: Event<T>, thisArgs: any = null, disposables?: IDisposable[]): Promise<T> {
    return new Promise((resolve) => once(event)(resolve, thisArgs, disposables));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EmptyEvent: Event<any> = () => EmptyDisposable;
