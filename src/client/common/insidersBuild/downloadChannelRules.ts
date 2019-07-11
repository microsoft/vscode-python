// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { IExtensionBuildInstaller, INSIDERS_INSTALLER, STABLE_INSTALLER } from '../installer/types';
import { traceDecorators } from '../logger';
import { IPersistentStateFactory } from '../types';
import { IExtensionChannelRule } from './types';

export const frequencyForDailyInsidersCheck = 1000 * 60 * 60 * 24; // One day.
export const frequencyForWeeklyInsidersCheck = 1000 * 60 * 60 * 24 * 7; // One week.
export const lastLookUpTimeKey = 'INSIDERS_LAST_LOOK_UP_TIME_KEY';

@injectable()
export class ExtensionStableChannelRule implements IExtensionChannelRule {
    constructor(@inject(IExtensionBuildInstaller) @named(STABLE_INSTALLER) private readonly stableInstaller: IExtensionBuildInstaller) { }
    public async getInstaller(isChannelRuleNew: boolean = false): Promise<IExtensionBuildInstaller | undefined> {
        if (isChannelRuleNew) {
            // Channel rule has changed to stable, return stable installer
            return this.stableInstaller;
        }
    }
}
@injectable()
export class ExtensionInsidersDailyChannelRule implements IExtensionChannelRule {
    constructor(
        @inject(IExtensionBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IExtensionBuildInstaller,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) { }
    @traceDecorators.error('Error in getting installer for daily channel rule')
    public async getInstaller(isChannelRuleNew: boolean): Promise<IExtensionBuildInstaller | undefined> {
        if (await this.shouldLookForInsidersBuild(isChannelRuleNew)) {
            return this.insidersInstaller;
        }
    }
    private async shouldLookForInsidersBuild(isChannelRuleNew: boolean): Promise<boolean> {
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (isChannelRuleNew) {
            // Channel rule has changed to insiders, look for insiders build
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
}
@injectable()
export class ExtensionInsidersWeeklyChannelRule implements IExtensionChannelRule {
    constructor(
        @inject(IExtensionBuildInstaller) @named(INSIDERS_INSTALLER) private readonly insidersInstaller: IExtensionBuildInstaller,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory
    ) { }
    @traceDecorators.error('Error in getting installer for weekly channel rule')
    public async getInstaller(isChannelRuleNew: boolean): Promise<IExtensionBuildInstaller | undefined> {
        if (await this.shouldLookForInsidersBuild(isChannelRuleNew)) {
            return this.insidersInstaller;
        }
    }
    private async shouldLookForInsidersBuild(isChannelRuleNew: boolean): Promise<boolean> {
        const lastLookUpTime = this.persistentStateFactory.createGlobalPersistentState(lastLookUpTimeKey, -1);
        if (isChannelRuleNew) {
            // Channel rule has changed to insiders, look for insiders build
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
}
