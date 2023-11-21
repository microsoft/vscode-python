// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { DebugLauncher } from './common/debugLauncher';
import { TestRunner } from './common/runner';
import { TestConfigSettingsService } from './common/configSettingService';
import { TestsHelper } from './common/testUtils';
import {
    ITestConfigSettingsService,
    ITestConfigurationManagerFactory,
    ITestConfigurationService,
    ITestDebugLauncher,
    ITestRunner,
    ITestsHelper,
    IUnitTestSocketServer,
} from './common/types';
import { UnitTestConfigurationService } from './configuration';
import { TestConfigurationManagerFactory } from './configurationFactory';
import { TestingService, UnitTestManagementService } from './main';
import { ITestingService } from './types';
import { UnitTestSocketServer } from './common/socketServer';
import { registerTestControllerTypes } from './testController/serviceRegistry';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher);

    serviceManager.add<ITestsHelper>(ITestsHelper, TestsHelper);
    serviceManager.add<IUnitTestSocketServer>(IUnitTestSocketServer, UnitTestSocketServer);

    serviceManager.add<ITestRunner>(ITestRunner, TestRunner);

    serviceManager.addSingleton<ITestConfigurationService>(ITestConfigurationService, UnitTestConfigurationService);
    serviceManager.addSingleton<ITestingService>(ITestingService, TestingService);

    serviceManager.addSingleton<ITestConfigSettingsService>(ITestConfigSettingsService, TestConfigSettingsService);
    serviceManager.addSingleton<ITestConfigurationManagerFactory>(
        ITestConfigurationManagerFactory,
        TestConfigurationManagerFactory,
    );
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, UnitTestManagementService);

    registerTestControllerTypes(serviceManager);
}
