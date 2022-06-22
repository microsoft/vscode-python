// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { injectable } from 'inversify';
import { IAsyncDisposableRegistry } from './types';
import { IDisposable } from './utils/resourceLifecycle';

// List of disposables that need to run a promise.
@injectable()
export class AsyncDisposableRegistry implements IAsyncDisposableRegistry {
    private disposables: IDisposable[] = [];

    constructor(...disposables: IDisposable[]) {
        this.disposables.push(...disposables);
    }

    public push(...disposables: IDisposable[]): void {
        this.disposables.push(...disposables);
    }

    public length(): number {
        return this.disposables.length;
    }

    public async dispose(): Promise<void> {
        const { disposables } = this;
        this.disposables = [];
        await Promise.all(
            disposables.map(async (d) => {
                try {
                    const promise = d.dispose();
                    if (promise) {
                        return promise;
                    }
                } catch (ex) {
                    // Don't do anything here
                }
                return Promise.resolve();
            }),
        );
    }
}
