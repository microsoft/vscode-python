// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export class StopWatch {
    private started: number = Date.now();
    public get elapsedTime() {
        return Date.now() - this.started;
    }
}
