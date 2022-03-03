// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { IAsyncDisposableRegistry } from './types';
import { Disposables, IDisposable } from './utils/resourceLifecycle';

// List of disposables that need to run a promise.
@injectable()
export class AsyncDisposableRegistry implements IAsyncDisposableRegistry {
    private readonly disposables = new Disposables();

    public push(...disposables: IDisposable[]): void {
        this.disposables.push(...disposables);
    }

    public async dispose(): Promise<void> {
        return this.disposables.dispose();
    }
}
