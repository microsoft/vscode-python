// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
import { CodeActionProviderService } from '../../client/providers/codeActionProvider/main';
import { SortImportsEditingProvider } from '../../client/providers/importSortProvider';
import { registerTypes } from '../../client/providers/serviceRegistry';
import { ISortImportsEditingProvider } from '../../client/providers/types';

suite('Common Providers Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));
        verify(
            serviceManager.addSingleton<ISortImportsEditingProvider>(
                ISortImportsEditingProvider,
                SortImportsEditingProvider
            )
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionSingleActivationService>(
                IExtensionSingleActivationService,
                CodeActionProviderService
            )
        ).once();
    });
});
