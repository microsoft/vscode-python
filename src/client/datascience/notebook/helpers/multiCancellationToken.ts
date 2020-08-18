// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, EventEmitter } from 'vscode';

/**
 * Cancellation token source that can be cancelled multiple times.
 */
export class MultiCancellationTokenSource {
    /**
     * The cancellation token of this source.
     */
    public readonly token: CancellationToken;
    private readonly eventEmitter = new EventEmitter<void>();
    constructor() {
        this.token = {
            isCancellationRequested: false,
            onCancellationRequested: this.eventEmitter.event.bind(this.eventEmitter)
        };
    }
    public cancel(): void {
        this.token.isCancellationRequested = true;
        this.eventEmitter.fire();
    }

    /**
     * Dispose object and free resources.
     */
    public dispose(): void {
        this.eventEmitter.dispose();
    }
}
