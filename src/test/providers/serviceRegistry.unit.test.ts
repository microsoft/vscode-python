// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
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
    });
});
