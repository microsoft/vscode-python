// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { registerTypes } from '../../client/activation/serviceRegistry';
import { IExtensionActivationService } from '../../client/activation/types';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceManager } from '../../client/ioc/types';
import { TestConfigSettingsService } from '../../client/testing/common/configSettingService';
import { DebugLauncher } from '../../client/testing/common/debugLauncher';
import { TestRunner } from '../../client/testing/common/runner';
import { UnitTestSocketServer } from '../../client/testing/common/socketServer';
import { TestsHelper } from '../../client/testing/common/testUtils';
import {
    ITestDebugLauncher,
    ITestsHelper,
    IUnitTestSocketServer,
    ITestRunner,
    ITestConfigurationService,
    ITestConfigSettingsService,
    ITestConfigurationManagerFactory,
} from '../../client/testing/common/types';
import { UnitTestConfigurationService } from '../../client/testing/configuration';
import { TestConfigurationManagerFactory } from '../../client/testing/configurationFactory';
import { TestingService, UnitTestManagementService } from '../../client/testing/main';
import { ITestingService } from '../../client/testing/types';

suite('Testing_Service_Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });
    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));

        verify(serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher)).once();
        verify(serviceManager.add<ITestsHelper>(ITestsHelper, TestsHelper)).once();
        verify(serviceManager.add<IUnitTestSocketServer>(IUnitTestSocketServer, UnitTestSocketServer)).once();
        verify(serviceManager.add<ITestRunner>(ITestRunner, TestRunner)).once();
        verify(
            serviceManager.addSingleton<ITestConfigurationService>(
                ITestConfigurationService,
                UnitTestConfigurationService,
            ),
        ).once();
        verify(serviceManager.addSingleton<ITestingService>(ITestingService, TestingService)).once();
        verify(
            serviceManager.addSingleton<ITestConfigSettingsService>(
                ITestConfigSettingsService,
                TestConfigSettingsService,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<ITestConfigurationManagerFactory>(
                ITestConfigurationManagerFactory,
                TestConfigurationManagerFactory,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<IExtensionActivationService>(
                IExtensionActivationService,
                UnitTestManagementService,
            ),
        ).once();
    });
});
