// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { SortImportsEditingProvider } from './importSortProvider';
import { QuickFixService } from './quickFixes/main';
import { ISortImportsEditingProvider } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ISortImportsEditingProvider>(ISortImportsEditingProvider, SortImportsEditingProvider);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, QuickFixService);
}
