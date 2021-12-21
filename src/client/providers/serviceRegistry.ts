// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { CodeActionProviderService } from './codeActionProvider/main';
import { SortImportsEditingProvider } from './importSortProvider';
import { ISortImportsEditingProvider } from './types';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<ISortImportsEditingProvider>(ISortImportsEditingProvider, SortImportsEditingProvider);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        CodeActionProviderService,
    );
}
