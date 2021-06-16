// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../../ioc/types';
import { PYTEST_PROVIDER } from '../common/constants';
import { TestDiscoveryHelper } from './common/discoveryHelper';
import { ITestController, ITestDiscovery, ITestDiscoveryHelper, ITestsRunner } from './common/types';
import { PytestDiscoveryService } from './pytest/discovery';
import { PytestController } from './pytest/pytestController';
import { PytestRunner } from './pytest/runner';

export function registerTestControllerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<ITestController>(ITestController, PytestController, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestDiscovery>(ITestDiscovery, PytestDiscoveryService, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestsRunner>(ITestsRunner, PytestRunner, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestDiscoveryHelper>(ITestDiscoveryHelper, TestDiscoveryHelper);
}
