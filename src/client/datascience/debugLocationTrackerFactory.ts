// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { DebugAdapterTracker, DebugSession, ProviderResult } from 'vscode';

import { IDebugService } from '../common/application/types';
import { IDisposableRegistry } from '../common/types';
import { IDebugLocationTracker, IDebugLocationTrackerFactory } from './types';

// Hook up our IDebugLocationTracker to python debugging sessions
@injectable()
export class DebugLocationTrackerFactory implements IDebugLocationTrackerFactory {
    constructor(
        @inject(IDebugLocationTracker) private locationTracker: IDebugLocationTracker,
        @inject(IDebugService) debugService: IDebugService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        disposableRegistry.push(debugService.registerDebugAdapterTrackerFactory('python', this));
    }

    public createDebugAdapterTracker(session: DebugSession): ProviderResult<DebugAdapterTracker> {
        this.locationTracker.setDebugSession(session);
        return this.locationTracker;
    }
}
