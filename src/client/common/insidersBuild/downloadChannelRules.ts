// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationEnvironment } from '../application/types';
import { IPersistentStateFactory } from '../types';
import { IInsidersDownloadChannelRule, IInsidersDownloadChannelService } from './types';

const frequencyForDailyInsidersCheck = 1000 * 60 * 60 * 24; // One day.
const frequencyForWeeklyInsidersCheck = 1000 * 60 * 60 * 24 * 7; // One week.
const lastLookUpTimeKey = 'INSIDERS_LAST_LOOK_UP_TIME_KEY';

@injectable()
export class IInsidersDownloadStableChannelRule implements IInsidersDownloadChannelRule {
    constructor(
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IInsidersDownloadChannelService) private readonly insidersDownloadChannelService: IInsidersDownloadChannelService,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) { }
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        if (this.appEnvironment.channel === 'insiders' && !this.insidersDownloadChannelService.hasUserConfiguredChannel) {
            // If using VS Code Insiders and channel is using default configuration, use insiders build as default
            const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        return false;
    }
    public async shouldLookForStableBuild(): Promise<boolean> {
        if (this.appEnvironment.channel === 'insiders' && !this.insidersDownloadChannelService.hasUserConfiguredChannel) {
            // If using VS Code Insiders and channel is using default configuration, do not use stable build
            return false;
        }
        return true;
    }
}
@injectable()
export class IInsidersDownloadDailyChannelRule implements IInsidersDownloadChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory) { }
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        // If we have not looked for it in the last 24 hours, then look.
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (lastLookUpTime.value === -1 || lastLookUpTime.value + frequencyForDailyInsidersCheck < Date.now()) {
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        return false;
    }
    public async shouldLookForStableBuild(): Promise<boolean> {
        return false;
    }
}
@injectable()
export class IInsidersDownloadWeeklyChannelRule implements IInsidersDownloadChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory) { }
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        // If we have not looked for it in the last week, then look.
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (lastLookUpTime.value === -1 || lastLookUpTime.value + frequencyForWeeklyInsidersCheck < Date.now()) {
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        return false;
    }
    public async shouldLookForStableBuild(): Promise<boolean> {
        return false;
    }
}
