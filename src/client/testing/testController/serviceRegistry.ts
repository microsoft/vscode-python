// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../../ioc/types';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../common/constants';
import { TestDiscoveryHelper } from './common/discoveryHelper';
import { ITestController, ITestDiscovery, ITestDiscoveryHelper, ITestsRunner } from './common/types';
import { PytestDiscoveryService } from './pytest/discovery';
import { PytestController } from './pytest/pytestController';
import { PytestRunner } from './pytest/runner';
import { UnittestDiscoveryService } from './unittest/discovery';
import { UnittestController } from './unittest/unittestController';

export function registerTestControllerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<ITestDiscoveryHelper>(ITestDiscoveryHelper, TestDiscoveryHelper);


    serviceManager.addSingleton<ITestController>(ITestController, PytestController, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestDiscovery>(ITestDiscovery, PytestDiscoveryService, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestsRunner>(ITestsRunner, PytestRunner, PYTEST_PROVIDER);

    serviceManager.addSingleton<ITestController>(ITestController, UnittestController, UNITTEST_PROVIDER);
    serviceManager.addSingleton<ITestDiscovery>(ITestDiscovery, UnittestDiscoveryService, UNITTEST_PROVIDER);
}
