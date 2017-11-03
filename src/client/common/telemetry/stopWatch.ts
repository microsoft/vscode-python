// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class StopWatch {
    private started: number = Date.now();
    private stopped?: number;
    public get elapsedTime() {
        return (this.stopped ? this.stopped : Date.now()) - this.started;
    }
    public stop() {
        this.stopped = Date.now();
    }
}
