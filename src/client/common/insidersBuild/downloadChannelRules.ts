// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Channel } from '../application/types';
import { IPersistentStateFactory } from '../types';
import { IInsidersDownloadChannelRule } from './types';

const frequencyForDailyInsidersCheck = 1000 * 60 * 60 * 24; // One day.
const frequencyForWeeklyInsidersCheck = 1000 * 60 * 60 * 24 * 7; // One week.
const lastLookUpTimeKey = 'INSIDERS_LAST_LOOK_UP_TIME_KEY';

@injectable()
export class IInsidersDownloadStableChannelRule implements IInsidersDownloadChannelRule {
    public async buildToLookFor(didChannelChange: boolean = false): Promise<Channel | undefined> {
        if (await this.shouldLookForInsidersBuild()) {
            return 'insiders';
        }
        if (await this.shouldLookForStableBuild(didChannelChange)) {
            return 'stable';
        }
    }
    private async shouldLookForInsidersBuild(): Promise<boolean> {
        return false;
    }
    private async shouldLookForStableBuild(didChannelChangeToStable: boolean): Promise<boolean> {
        return didChannelChangeToStable;
    }
}
@injectable()
export class IInsidersDownloadDailyChannelRule implements IInsidersDownloadChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory) { }
    public async buildToLookFor(): Promise<Channel | undefined> {
        if (await this.shouldLookForInsidersBuild()) {
            return 'insiders';
        }
        if (await this.shouldLookForStableBuild()) {
            return 'stable';
        }
    }
    private async shouldLookForInsidersBuild(): Promise<boolean> {
        // If we have not looked for it in the last 24 hours, then look.
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (lastLookUpTime.value === -1 || lastLookUpTime.value + frequencyForDailyInsidersCheck < Date.now()) {
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        return false;
    }
    private async shouldLookForStableBuild(): Promise<boolean> {
        return false;
    }
}
@injectable()
export class IInsidersDownloadWeeklyChannelRule implements IInsidersDownloadChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory) { }
    public async buildToLookFor(): Promise<Channel | undefined> {
        if (await this.shouldLookForInsidersBuild()) {
            return 'insiders';
        }
        if (await this.shouldLookForStableBuild()) {
            return 'stable';
        }
    }
    private async shouldLookForInsidersBuild(): Promise<boolean> {
        // If we have not looked for it in the last week, then look.
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (lastLookUpTime.value === -1 || lastLookUpTime.value + frequencyForWeeklyInsidersCheck < Date.now()) {
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        return false;
    }
    private async shouldLookForStableBuild(): Promise<boolean> {
        return false;
    }
}
