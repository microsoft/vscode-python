// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IAsyncDisposable, IDisposable } from '../types';

// tslint:disable-next-line:no-empty
export function noop() { }

export function using<T extends IDisposable>(disposable: T, func: (obj: T) => void) {
    try {
        func(disposable);
    } finally {
        disposable.dispose();
    }
}

export async function usingAsync<T extends IAsyncDisposable, R>(disposable: T, func: (obj: T) => Promise<R>) : Promise<R> {
    try {
        return await func(disposable);
    } finally {
        await disposable.dispose();
    }
}
