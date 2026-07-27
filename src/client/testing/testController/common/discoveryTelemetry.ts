// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { StopWatch } from '../../../common/utils/stopWatch';

/** Source that requested a test discovery refresh. */
export type DiscoveryTriggerKind = 'auto' | 'ui' | 'commandpalette' | 'watching' | 'interpreter';

/** Testing architecture used for discovery. */
export type DiscoveryMode = 'project' | 'legacy';

export interface DiscoveryTelemetryCycle {
    mode: DiscoveryMode;
    trigger?: DiscoveryTriggerKind;
    stopWatch: StopWatch;
}

export class DiscoveryTelemetryState {
    private activeCycle?: DiscoveryTelemetryCycle;

    constructor(public readonly defaultMode: DiscoveryMode) {}

    public start(context: Omit<DiscoveryTelemetryCycle, 'stopWatch'>): void {
        this.activeCycle = { ...context, stopWatch: new StopWatch() };
    }

    public complete(): DiscoveryTelemetryCycle | undefined {
        const cycle = this.activeCycle;
        this.activeCycle = undefined;
        return cycle;
    }
}
