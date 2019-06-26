// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IPersistentStateFactory } from '../../common/types';
import { IInsidersDownloadChannelRule } from './types';

const lastCheckedForDailyInsidersCheckKey = 'INSIDERS.DAILY.LAST.CHECK.TIME';
const lastCheckedForWeeklyInsidersCheckKey = 'INSIDERS.WEEKLY.LAST.CHECK.TIME';
const frequencyForDailyInsidersCheck = 1000 * 60 * 60 * 24; // One day.
const frequencyForWeeklyInsidersCheck = 1000 * 60 * 60 * 24 * 7; // One week.

@injectable()
export class IInsidersDownloadStableChannelRule implements IInsidersDownloadChannelRule {
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        return false;
    }
}
@injectable()
export class IInsidersDownloadDailyChannelRule implements IInsidersDownloadChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory) { }
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        const shouldLook = this.stateFactory.createGlobalPersistentState<boolean>(lastCheckedForWeeklyInsidersCheckKey,
            true,
            frequencyForWeeklyInsidersCheck);

        // If we have checked it in the last 24 hours, then ensure we don't do it again.
        if (shouldLook.value) {
            await shouldLook.updateValue(false);
            return true;
        }
        return shouldLook.value;
    }
}
@injectable()
export class IInsidersDownloadWeeklyChannelRule implements IInsidersDownloadChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory) { }
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        const shouldLook = this.stateFactory.createGlobalPersistentState<boolean>(lastCheckedForDailyInsidersCheckKey,
            true,
            frequencyForDailyInsidersCheck);

        // If we have checked it in the last week, then ensure we don't do it again.
        if (shouldLook.value) {
            await shouldLook.updateValue(false);
            return true;
        }
        return shouldLook.value;
    }
}
