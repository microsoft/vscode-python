// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import {
    DebugAdapterTracker,
    DebugAdapterTrackerFactory,
    DebugSession,
    Event,
    EventEmitter,
    ProviderResult,
} from 'vscode';

import { IDebugService } from '../common/application/types';
import { IDisposableRegistry } from '../common/types';
import { DebugLocationTracker } from './debugLocationTracker';
import { IDebugLocationTracker } from './types';

// Hook up our IDebugLocationTracker to python debugging sessions
@injectable()
export class DebugLocationTrackerFactory implements IDebugLocationTracker, DebugAdapterTrackerFactory {
    private activeTrackers: Map<string, DebugLocationTracker> = new Map<string, DebugLocationTracker>();
    private updatedEmitter: EventEmitter<void> = new EventEmitter<void>();

    constructor(
        @inject(IDebugService) debugService: IDebugService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(debugService.registerDebugAdapterTrackerFactory('python', this));
    }

    public createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
        const result = new DebugLocationTracker(session.id);
        this.activeTrackers.set(session.id, result);
        result.sessionEnded(this.onSessionEnd.bind(this));
        result.debugLocationUpdated(this.onLocationUpdated.bind(this));
        this.onLocationUpdated();
        return result;
    }

    public get updated(): Event<void> {
        return this.updatedEmitter.event;
    }

    public getLocation(session: DebugSession) {
        const tracker = this.activeTrackers.get(session.id);
        if (tracker) {
            return tracker.debugLocation;
        }
    }

    private onSessionEnd(locationTracker: DebugLocationTracker) {
        this.activeTrackers.delete(locationTracker.sessionId);
    }

    private onLocationUpdated() {
        this.updatedEmitter.fire();
    }
}
