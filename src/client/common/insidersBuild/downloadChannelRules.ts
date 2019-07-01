// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { IBuildInstaller, INSIDERS_INSTALLER, STABLE_INSTALLER } from '../installer/types';
import { IPersistentStateFactory } from '../types';
import { IInsidersDownloadChannelRule } from './types';

const frequencyForDailyInsidersCheck = 1000 * 60 * 60 * 24; // One day.
const frequencyForWeeklyInsidersCheck = 1000 * 60 * 60 * 24 * 7; // One week.
const lastLookUpTimeKey = 'INSIDERS_LAST_LOOK_UP_TIME_KEYpppzz';

@injectable()
export class IInsidersDownloadStableChannelRule implements IInsidersDownloadChannelRule {
    constructor(
        @inject(IBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IBuildInstaller,
        @inject(IBuildInstaller) @named(STABLE_INSTALLER) private readonly stableInstaller: IBuildInstaller
    ) { }
    public async getInstallerForBuild(didChannelChange: boolean = false): Promise<IBuildInstaller | undefined> {
        if (await this.shouldLookForInsidersBuild()) {
            return this.insidersInstaller;
        }
        if (await this.shouldLookForStableBuild(didChannelChange)) {
            return this.stableInstaller;
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
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IBuildInstaller,
        @inject(IBuildInstaller) @named(STABLE_INSTALLER) private readonly stableInstaller: IBuildInstaller
    ) { }
    public async getInstallerForBuild(didChannelChange: boolean): Promise<IBuildInstaller | undefined> {
        if (await this.shouldLookForInsidersBuild(didChannelChange)) {
            return this.insidersInstaller;
        }
        if (await this.shouldLookForStableBuild()) {
            return this.stableInstaller;
        }
    }
    private async shouldLookForInsidersBuild(didChannelChange: boolean): Promise<boolean> {
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (didChannelChange) {
            // Channel changed to insiders, look for insiders build
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        // If we have not looked for it in the last 24 hours, then look.
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
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IBuildInstaller,
        @inject(IBuildInstaller) @named(STABLE_INSTALLER) private readonly stableInstaller: IBuildInstaller
    ) { }
    public async getInstallerForBuild(didChannelChange: boolean): Promise<IBuildInstaller | undefined> {
        if (await this.shouldLookForInsidersBuild(didChannelChange)) {
            return this.insidersInstaller;
        }
        if (await this.shouldLookForStableBuild()) {
            return this.stableInstaller;
        }
    }
    private async shouldLookForInsidersBuild(didChannelChange: boolean): Promise<boolean> {
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (didChannelChange) {
            // Channel changed to insiders, look for insiders build
            await lastLookUpTime.updateValue(Date.now());
            return true;
        }
        // If we have not looked for it in the last week, then look.
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
