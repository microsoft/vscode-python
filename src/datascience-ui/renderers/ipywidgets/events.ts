// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event, IDisposable } from './types';

// tslint:disable: interface-name prefer-method-signature
type Listener<T> = { fn: (evt: T) => void; thisArg: unknown };

interface EmitterLike<T> {
    event: Event<T>;
    fire(data: T): void;
}

export function createEmitter<T>(
    listenerChange: (listeners: Set<Listener<T>>) => void = () => undefined
): EmitterLike<T> {
    const listeners = new Set<Listener<T>>();
    return {
        fire(data) {
            listeners.forEach((listener) => listener.fn.call(listener.thisArg, data));
        },
        event(fn, thisArg, disposables) {
            const listenerObj = { fn, thisArg };
            const disposable: IDisposable = {
                dispose: () => {
                    listeners.delete(listenerObj);
                    listenerChange(listeners);
                }
            };

            listeners.add(listenerObj);
            listenerChange(listeners);
            if (disposables) {
                disposables.push(disposable);
            }

            return disposable;
        }
    };
}
