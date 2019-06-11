// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { IExtensionActivationService } from '../../client/activation/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { AutoDisplayTestExplorer } from '../../client/testing/explorer/autoDisplayTestExplorer';
import { registerTypes } from '../../client/testing/serviceRegistry';

suite('Unit Tests Test Explorer - Register Classes in IOC container', () => {
    test('AutoDisplayTestExplorer class is registered', async () => {
        const serviceContainer = mock(ServiceManager);

        registerTypes(instance(serviceContainer));

        verify(serviceContainer.addSingleton<IExtensionActivationService>(IExtensionActivationService, AutoDisplayTestExplorer)).once();
    });
});
