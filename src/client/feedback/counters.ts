// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EventEmitter } from 'events';

const FEARTURES_USAGE_COUNTER = 'FEARTURES_USAGE';
const TEXT_EDIT_COUNTER = 'TEXT_EDIT';
type counters = 'FEARTURES_USAGE' | 'TEXT_EDIT';

export class FeedbackCounters extends EventEmitter {
    private counters = new Map<string, { counter: number; threshold: number; }>();
    constructor() {
        super();
        this.createCounters();
    }
    public updateTextEditCounter(): void {
        this.updateCounter(TEXT_EDIT_COUNTER);
    }
    public updateFeatureUsageCounter(): void {
        this.updateCounter(FEARTURES_USAGE_COUNTER);
    }
    private createCounters() {
        this.counters.set(TEXT_EDIT_COUNTER, { counter: 0, threshold: 5000 });
        this.counters.set(FEARTURES_USAGE_COUNTER, { counter: 0, threshold: 10000 });
    }
    private updateCounter(counterName: counters): void {
        if (!this.counters.has(counterName)) {
            console.error(`Counter ${counterName} not supported in the feedback module of the Python Extension`);
            return;
        }

        // tslint:disable-next-line:no-non-null-assertion
        const value = this.counters.get(counterName)!;
        value.counter += 1;

        this.checkThreshold();
    }
    private checkThreshold() {
        let thresholdReached = false;
        this.counters.forEach((value, key) => {
            if (value.counter < value.threshold) {
                return;
            }
            thresholdReached = true;
        });

        if (thresholdReached) {
            this.emit('thresholdReached');
        }
    }
}
