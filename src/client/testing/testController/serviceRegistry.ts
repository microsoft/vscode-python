// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../common/constants';
import { TestDiscoveryHelper } from './common/discoveryHelper';
import { ITestFrameworkController, ITestDiscoveryHelper, ITestsRunner, ITestController } from './common/types';
import { PythonTestController } from './controller';
import { PytestController } from './pytest/pytestController';
import { PytestRunner } from './pytest/runner';
import { UnittestRunner } from './unittest/runner';
import { UnittestController } from './unittest/unittestController';

export function registerTestControllerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<ITestDiscoveryHelper>(ITestDiscoveryHelper, TestDiscoveryHelper);

    serviceManager.addSingleton<ITestFrameworkController>(ITestFrameworkController, PytestController, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestsRunner>(ITestsRunner, PytestRunner, PYTEST_PROVIDER);

    serviceManager.addSingleton<ITestFrameworkController>(
        ITestFrameworkController,
        UnittestController,
        UNITTEST_PROVIDER,
    );
    serviceManager.addSingleton<ITestsRunner>(ITestsRunner, UnittestRunner, UNITTEST_PROVIDER);
    serviceManager.addSingleton<ITestController>(ITestController, PythonTestController);
    serviceManager.addBinding(ITestController, IExtensionSingleActivationService);
}
