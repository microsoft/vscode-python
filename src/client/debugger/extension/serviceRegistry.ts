// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../../ioc/types';
import { DebuggerBanner } from './banner';
import { IDebuggerBanner } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
}
