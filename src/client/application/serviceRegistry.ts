// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IServiceManager } from '../ioc/types';
import { registerTypes as diagnosticsRegisterTypes } from './diagnostics/serviceRegistry';
import { registerTypes as importPathRegisterTypes } from './importPath/serviceRegistry';

export function registerTypes(serviceManager: IServiceManager) {
    diagnosticsRegisterTypes(serviceManager);
    importPathRegisterTypes(serviceManager);
}
