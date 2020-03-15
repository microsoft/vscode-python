// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { IAsyncDisposable, IAsyncDisposableRegistry, IDisposable } from './types';

// List of disposables that need to run a promise.
@injectable()
export class AsyncDisposableRegistry implements IAsyncDisposableRegistry {
    private _list: (IDisposable | IAsyncDisposable)[] = [];

    public async dispose(): Promise<void> {
        const promises = this._list.map(l => l.dispose());
        await Promise.all(promises);
        this._list = [];
    }

    public push(disposable?: IDisposable | IAsyncDisposable) {
        if (disposable) {
            this._list.push(disposable);
        }
    }

    public get list(): (IDisposable | IAsyncDisposable)[] {
        return this._list;
    }
}
