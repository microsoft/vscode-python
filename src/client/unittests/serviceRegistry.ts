// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { ArgumentsHelper } from './common/argumentsHelper';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from './common/constants';
import { DebugLauncher } from './common/debugLauncher';
import { TestRunner } from './common/runner';
import { TestConfigSettingsService } from './common/services/configSettingService';
import { TestCollectionStorageService } from './common/services/storageService';
import { TestManagerService } from './common/services/testManagerService';
import { TestResultsService } from './common/services/testResultsService';
import { WorkspaceTestManagerService } from './common/services/workspaceTestManagerService';
import { TestsHelper } from './common/testUtils';
import { TestFlatteningVisitor } from './common/testVisitors/flatteningVisitor';
import { TestFolderGenerationVisitor } from './common/testVisitors/folderGenerationVisitor';
import { TestResultResetVisitor } from './common/testVisitors/resultResetVisitor';
import {
    ITestCollectionStorageService, ITestConfigSettingsService, ITestDebugLauncher, ITestDiscoveryService, ITestManager, ITestManagerFactory, ITestManagerService, ITestManagerServiceFactory,
    ITestResultsService, ITestRunner, ITestsHelper, ITestsParser, ITestVisitor, IUnitTestSocketServer, IWorkspaceTestManagerService, IXUnitParser, TestProvider
} from './common/types';
import { XUnitParser } from './common/xUnitParser';
import { UnitTestConfigurationService } from './configuration';
import { TestConfigurationManagerFactory } from './configurationFactory';
import { TestResultDisplay } from './display/main';
import { TestDisplay } from './display/picker';
import { UnitTestManagementService } from './main';
import { TestManager as NoseTestManager } from './nosetest/main';
import { TestManagerRunner as NoseTestManagerRunner } from './nosetest/runner';
import { ArgumentsService as NoseTestArgumentsService } from './nosetest/services/argsService';
import { TestDiscoveryService as NoseTestDiscoveryService } from './nosetest/services/discoveryService';
import { TestsParser as NoseTestTestsParser } from './nosetest/services/parserService';
import { TestManager as PyTestTestManager } from './pytest/main';
import { TestManagerRunner as PytestManagerRunner } from './pytest/runner';
import { ArgumentsService as PyTestArgumentsService } from './pytest/services/argsService';
import { TestDiscoveryService as PytestTestDiscoveryService } from './pytest/services/discoveryService';
import { TestsParser as PytestTestsParser } from './pytest/services/parserService';
import { IArgumentsHelper, IArgumentsService, ITestConfigurationManagerFactory, ITestDisplay, ITestManagerRunner, ITestResultDisplay, IUnitTestConfigurationService, IUnitTestHelper, IUnitTestManagementService } from './types';
import { UnitTestHelper } from './unittest/helper';
import { TestManager as UnitTestTestManager } from './unittest/main';
import { TestManagerRunner as UnitTestTestManagerRunner } from './unittest/runner';
import { ArgumentsService as UnitTestArgumentsService } from './unittest/services/argsService';
import { TestDiscoveryService as UnitTestTestDiscoveryService } from './unittest/services/discoveryService';
import { TestsParser as UnitTestTestsParser } from './unittest/services/parserService';
import { UnitTestSocketServer } from './unittest/socketServer';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher);
    serviceManager.addSingleton<ITestCollectionStorageService>(ITestCollectionStorageService, TestCollectionStorageService);
    serviceManager.addSingleton<IWorkspaceTestManagerService>(IWorkspaceTestManagerService, WorkspaceTestManagerService);

    serviceManager.add<ITestsHelper>(ITestsHelper, TestsHelper);
    serviceManager.add<IUnitTestSocketServer>(IUnitTestSocketServer, UnitTestSocketServer);

    serviceManager.add<ITestResultsService>(ITestResultsService, TestResultsService);

    serviceManager.add<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
    serviceManager.add<ITestVisitor>(ITestVisitor, TestFolderGenerationVisitor, 'TestFolderGenerationVisitor');
    serviceManager.add<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');

    serviceManager.add<ITestsParser>(ITestsParser, UnitTestTestsParser, UNITTEST_PROVIDER);
    serviceManager.add<ITestsParser>(ITestsParser, PytestTestsParser, PYTEST_PROVIDER);
    serviceManager.add<ITestsParser>(ITestsParser, NoseTestTestsParser, NOSETEST_PROVIDER);

    serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, UnitTestTestDiscoveryService, UNITTEST_PROVIDER);
    serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, PytestTestDiscoveryService, PYTEST_PROVIDER);
    serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, NoseTestDiscoveryService, NOSETEST_PROVIDER);

    serviceManager.add<IArgumentsHelper>(IArgumentsHelper, ArgumentsHelper);
    serviceManager.add<ITestRunner>(ITestRunner, TestRunner);
    serviceManager.add<IXUnitParser>(IXUnitParser, XUnitParser);
    serviceManager.add<IUnitTestHelper>(IUnitTestHelper, UnitTestHelper);

    serviceManager.add<IArgumentsService>(IArgumentsService, PyTestArgumentsService, PYTEST_PROVIDER);
    serviceManager.add<IArgumentsService>(IArgumentsService, NoseTestArgumentsService, NOSETEST_PROVIDER);
    serviceManager.add<IArgumentsService>(IArgumentsService, UnitTestArgumentsService, UNITTEST_PROVIDER);
    serviceManager.add<ITestManagerRunner>(ITestManagerRunner, PytestManagerRunner, PYTEST_PROVIDER);
    serviceManager.add<ITestManagerRunner>(ITestManagerRunner, NoseTestManagerRunner, NOSETEST_PROVIDER);
    serviceManager.add<ITestManagerRunner>(ITestManagerRunner, UnitTestTestManagerRunner, UNITTEST_PROVIDER);

    serviceManager.addSingleton<IUnitTestConfigurationService>(IUnitTestConfigurationService, UnitTestConfigurationService);
    serviceManager.addSingleton<IUnitTestManagementService>(IUnitTestManagementService, UnitTestManagementService);
    serviceManager.addSingleton<ITestResultDisplay>(ITestResultDisplay, TestResultDisplay);
    serviceManager.addSingleton<ITestDisplay>(ITestDisplay, TestDisplay);
    serviceManager.addSingleton<ITestConfigSettingsService>(ITestConfigSettingsService, TestConfigSettingsService);
    serviceManager.addSingleton<ITestConfigurationManagerFactory>(ITestConfigurationManagerFactory, TestConfigurationManagerFactory);

    serviceManager.addFactory<ITestManager>(ITestManagerFactory, (context) => {
        return (testProvider: TestProvider, workspaceFolder: Uri, rootDirectory: string) => {
            const serviceContainer = context.container.get<IServiceContainer>(IServiceContainer);

            switch (testProvider) {
                case NOSETEST_PROVIDER: {
                    return new NoseTestManager(workspaceFolder, rootDirectory, serviceContainer);
                }
                case PYTEST_PROVIDER: {
                    return new PyTestTestManager(workspaceFolder, rootDirectory, serviceContainer);
                }
                case UNITTEST_PROVIDER: {
                    return new UnitTestTestManager(workspaceFolder, rootDirectory, serviceContainer);
                }
                default: {
                    throw new Error(`Unrecognized test provider '${testProvider}'`);
                }
            }
        };
    });

    serviceManager.addFactory<ITestManagerService>(ITestManagerServiceFactory, (context) => {
        return (workspaceFolder: Uri) => {
            const serviceContainer = context.container.get<IServiceContainer>(IServiceContainer);
            const testsHelper = context.container.get<ITestsHelper>(ITestsHelper);
            return new TestManagerService(workspaceFolder, testsHelper, serviceContainer);
        };
    });
}
