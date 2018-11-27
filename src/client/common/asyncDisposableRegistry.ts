// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';

import { IAsyncDisposable, IAsyncDisposableRegistry } from './types';

// List of disposables that need to run a promise.
@injectable()
export class AsyncDisposableRegistry implements IAsyncDisposableRegistry {
    private list : IAsyncDisposable[] = [];

    public async disposeAsync(): Promise<void> {
        const promises = this.list.map(l => l.disposeAsync());
        await Promise.all(promises);
    }

    public push(disposable: IAsyncDisposable) {
        this.list.push(disposable);
    }
}
