// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IExtensionActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { ExtensionInsidersDailyChannelRule, ExtensionInsidersWeeklyChannelRule, ExtensionStableChannelRule } from './downloadChannelRules';
import { ExtensionChannelService } from './downloadChannelService';
import { InsidersExtensionService } from './insidersExtensionService';
import { InsidersExtensionPrompt } from './insidersPrompt';
import { ExtensionChannel, IExtensionChannelRule, IExtensionChannelService, IInsiderExtensionPrompt } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IInsiderExtensionPrompt>(IInsiderExtensionPrompt, InsidersExtensionPrompt);
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, InsidersExtensionService);
    serviceManager.addSingleton<IExtensionChannelService>(IExtensionChannelService, ExtensionChannelService);
    serviceManager.addSingleton<IExtensionChannelRule>(IExtensionChannelRule, ExtensionStableChannelRule, ExtensionChannel.stable);
    serviceManager.addSingleton<IExtensionChannelRule>(IExtensionChannelRule, ExtensionInsidersDailyChannelRule, ExtensionChannel.daily);
    serviceManager.addSingleton<IExtensionChannelRule>(IExtensionChannelRule, ExtensionInsidersWeeklyChannelRule, ExtensionChannel.weekly);
}
