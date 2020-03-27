// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../activation/types';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { ArgumentsHelper } from './common/argumentsHelper';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from './common/constants';
import { DebugLauncher } from './common/debugLauncher';
import { EnablementTracker } from './common/enablementTracker';
import { TestRunner } from './common/runner';
import { TestConfigSettingsService } from './common/services/configSettingService';
import { TestContextService } from './common/services/contextService';
import { TestDiscoveredTestParser } from './common/services/discoveredTestParser';
import { TestsDiscoveryService } from './common/services/discovery';
import { TestCollectionStorageService } from './common/services/storageService';
import { TestManagerService } from './common/services/testManagerService';
import { TestResultsService } from './common/services/testResultsService';
import { TestsStatusUpdaterService } from './common/services/testsStatusService';
import { ITestDiscoveredTestParser } from './common/services/types';
import { UnitTestDiagnosticService } from './common/services/unitTestDiagnosticService';
import { WorkspaceTestManagerService } from './common/services/workspaceTestManagerService';
import { TestsHelper } from './common/testUtils';
import { TestFlatteningVisitor } from './common/testVisitors/flatteningVisitor';
import { TestResultResetVisitor } from './common/testVisitors/resultResetVisitor';
import {
    ITestCollectionStorageService,
    ITestContextService,
    ITestDebugLauncher,
    ITestDiscoveryService,
    ITestManager,
    ITestManagerFactory,
    ITestManagerService,
    ITestManagerServiceFactory,
    ITestMessageService,
    ITestResultsService,
    ITestRunner,
    ITestsHelper,
    ITestsParser,
    ITestsStatusUpdaterService,
    ITestVisitor,
    IUnitTestSocketServer,
    IWorkspaceTestManagerService,
    IXUnitParser,
    TestProvider
} from './common/types';
import { UpdateTestSettingService } from './common/updateTestSettings';
import { XUnitParser } from './common/xUnitParser';
import { UnitTestConfigurationService } from './configuration';
import { TestConfigurationManagerFactory } from './configurationFactory';
import { TestResultDisplay } from './display/main';
import { TestDisplay } from './display/picker';
import { TestExplorerCommandHandler } from './explorer/commandHandlers';
import { FailedTestHandler } from './explorer/failedTestHandler';
import { TestTreeViewProvider } from './explorer/testTreeViewProvider';
import { TreeViewService } from './explorer/treeView';
import { UnitTestManagementService } from './main';
import { registerTypes as registerNavigationTypes } from './navigation/serviceRegistry';
import { ITestExplorerCommandHandler } from './navigation/types';
import { TestManager as NoseTestManager } from './nosetest/main';
import { TestManagerRunner as NoseTestManagerRunner } from './nosetest/runner';
import { ArgumentsService as NoseTestArgumentsService } from './nosetest/services/argsService';
import { TestDiscoveryService as NoseTestDiscoveryService } from './nosetest/services/discoveryService';
import { TestsParser as NoseTestTestsParser } from './nosetest/services/parserService';
import { TestManager as PyTestTestManager } from './pytest/main';
import { TestManagerRunner as PytestManagerRunner } from './pytest/runner';
import { ArgumentsService as PyTestArgumentsService } from './pytest/services/argsService';
import { TestDiscoveryService as PytestTestDiscoveryService } from './pytest/services/discoveryService';
import { TestMessageService } from './pytest/services/testMessageService';
import {
    IArgumentsHelper,
    IArgumentsService,
    ITestConfigSettingsService,
    ITestConfigurationManagerFactory,
    ITestConfigurationService,
    ITestDataItemResource,
    ITestDiagnosticService,
    ITestDisplay,
    ITestManagementService,
    ITestManagerRunner,
    ITestResultDisplay,
    ITestTreeViewProvider,
    IUnitTestHelper
} from './types';
import { UnitTestHelper } from './unittest/helper';
import { TestManager as UnitTestTestManager } from './unittest/main';
import { TestManagerRunner as UnitTestTestManagerRunner } from './unittest/runner';
import { ArgumentsService as UnitTestArgumentsService } from './unittest/services/argsService';
import { TestDiscoveryService as UnitTestTestDiscoveryService } from './unittest/services/discoveryService';
import { TestsParser as UnitTestTestsParser } from './unittest/services/parserService';
import { UnitTestSocketServer } from './unittest/socketServer';

export function registerTypes(serviceManager: IServiceManager) {
    registerNavigationTypes(serviceManager);
    serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher);
    serviceManager.addSingleton<ITestCollectionStorageService>(
        ITestCollectionStorageService,
        TestCollectionStorageService
    );
    serviceManager.addSingleton<IWorkspaceTestManagerService>(
        IWorkspaceTestManagerService,
        WorkspaceTestManagerService
    );

    serviceManager.add<ITestsHelper>(ITestsHelper, TestsHelper);
    serviceManager.add<ITestDiscoveredTestParser>(ITestDiscoveredTestParser, TestDiscoveredTestParser);
    serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, TestsDiscoveryService, 'common');
    serviceManager.add<IUnitTestSocketServer>(IUnitTestSocketServer, UnitTestSocketServer);
    serviceManager.addSingleton<ITestContextService>(ITestContextService, TestContextService);
    serviceManager.addSingleton<ITestsStatusUpdaterService>(ITestsStatusUpdaterService, TestsStatusUpdaterService);

    serviceManager.add<ITestResultsService>(ITestResultsService, TestResultsService);

    serviceManager.add<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
    serviceManager.add<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');

    serviceManager.add<ITestsParser>(ITestsParser, UnitTestTestsParser, UNITTEST_PROVIDER);
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

    serviceManager.addSingleton<ITestConfigurationService>(ITestConfigurationService, UnitTestConfigurationService);
    serviceManager.addSingleton<ITestManagementService>(ITestManagementService, UnitTestManagementService);
    serviceManager.addSingleton<ITestResultDisplay>(ITestResultDisplay, TestResultDisplay);
    serviceManager.addSingleton<ITestDisplay>(ITestDisplay, TestDisplay);
    serviceManager.addSingleton<ITestConfigSettingsService>(ITestConfigSettingsService, TestConfigSettingsService);
    serviceManager.addSingleton<ITestConfigurationManagerFactory>(
        ITestConfigurationManagerFactory,
        TestConfigurationManagerFactory
    );

    serviceManager.addSingleton<ITestDiagnosticService>(ITestDiagnosticService, UnitTestDiagnosticService);
    serviceManager.addSingleton<ITestMessageService>(ITestMessageService, TestMessageService, PYTEST_PROVIDER);
    serviceManager.addSingleton<ITestTreeViewProvider>(ITestTreeViewProvider, TestTreeViewProvider);
    serviceManager.addSingleton<ITestDataItemResource>(ITestDataItemResource, TestTreeViewProvider);
    serviceManager.addSingleton<ITestExplorerCommandHandler>(ITestExplorerCommandHandler, TestExplorerCommandHandler);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, TreeViewService);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        FailedTestHandler
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        EnablementTracker
    );
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, UpdateTestSettingService);

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
