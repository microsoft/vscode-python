// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { traceDecoratorError } from '../../logging';
import { IPersistentStateFactory } from '../types';
import { IExtensionChannelRule } from './types';

export const frequencyForDailyInsidersCheck = 1000 * 60 * 60 * 24; // One day.
export const frequencyForWeeklyInsidersCheck = 1000 * 60 * 60 * 24 * 7; // One week.
export const lastLookUpTimeKey = 'INSIDERS_LAST_LOOK_UP_TIME_KEY';

/**
 * Determines if we should install insiders when install channel is set of "off".
 * "off" setting is defined as a no op, which means we should not be looking for insiders.
 *
 * @export
 * @class ExtensionInsidersOffChannelRule
 * @implements {IExtensionChannelRule}
 */
@injectable()
export class ExtensionInsidersOffChannelRule implements IExtensionChannelRule {
    public async shouldLookForInsidersBuild(): Promise<boolean> {
        return false;
    }
}
@injectable()
export class ExtensionInsidersDailyChannelRule implements IExtensionChannelRule {
    constructor(@inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory) {}
    @traceDecoratorError('Error in checking if insiders build is to be for daily channel rule')
    public async shouldLookForInsidersBuild(isChannelRuleNew: boolean): Promise<boolean> {
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
    constructor(@inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory) {}
    @traceDecoratorError('Error in checking if insiders build is to be for daily channel rule')
    public async shouldLookForInsidersBuild(isChannelRuleNew: boolean): Promise<boolean> {
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
