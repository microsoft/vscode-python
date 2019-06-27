// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { IInsidersDownloadDailyChannelRule, IInsidersDownloadStableChannelRule, IInsidersDownloadWeeklyChannelRule } from './downloadChannelRules';
import { InsidersDownloadChannelService } from './downloadChannelService';
import { InsidersPrompt } from './insidersPrompt';
import { IInsidersDownloadChannelRule, IInsidersDownloadChannelService, IInsidersPrompt, InsidersBuildDownloadChannel } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IInsidersPrompt>(IInsidersPrompt, InsidersPrompt);
    serviceManager.addSingleton<IInsidersDownloadChannelService>(IInsidersDownloadChannelService, InsidersDownloadChannelService);
    serviceManager.addSingleton<IInsidersDownloadChannelRule>(IInsidersDownloadChannelRule, IInsidersDownloadStableChannelRule, InsidersBuildDownloadChannel.stable);
    serviceManager.addSingleton<IInsidersDownloadChannelRule>(IInsidersDownloadChannelRule, IInsidersDownloadDailyChannelRule, InsidersBuildDownloadChannel.daily);
    serviceManager.addSingleton<IInsidersDownloadChannelRule>(IInsidersDownloadChannelRule, IInsidersDownloadWeeklyChannelRule, InsidersBuildDownloadChannel.weekly);
}
