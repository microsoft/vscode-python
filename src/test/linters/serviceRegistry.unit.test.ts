// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { IExtensionActivationService } from '../../client/activation/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
import { AvailableLinterActivator } from '../../client/linters/linterAvailability';
import { LinterManager } from '../../client/linters/linterManager';
import { LintingEngine } from '../../client/linters/lintingEngine';
import { registerTypes } from '../../client/linters/serviceRegistry';
import { IAvailableLinterActivator, ILinterManager, ILintingEngine } from '../../client/linters/types';
import { LinterProvider } from '../../client/providers/linterProvider';

suite('Linters Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));
        verify(serviceManager.addSingleton<ILintingEngine>(ILintingEngine, LintingEngine)).once();
        verify(serviceManager.addSingleton<ILinterManager>(ILinterManager, LinterManager)).once();
        verify(
            serviceManager.add<IAvailableLinterActivator>(IAvailableLinterActivator, AvailableLinterActivator)
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, LinterProvider)
        ).once();
    });
});
