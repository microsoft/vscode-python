// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceContainer, IServiceManager } from '../ioc/types';
import { registerForIOC } from './legacyIOC';

export function activate(serviceManager: IServiceManager, serviceContainer: IServiceContainer) {
    registerForIOC(serviceManager, serviceContainer);
}
