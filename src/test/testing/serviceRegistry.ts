// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';

import { IProcessServiceFactory } from '../../client/common/process/types';
import { IInterpreterHelper } from '../../client/interpreter/contracts';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { IServiceContainer } from '../../client/ioc/types';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../client/testing/common/constants';
import { TestContextService } from '../../client/testing/common/services/contextService';
import { TestDiscoveredTestParser } from '../../client/testing/common/services/discoveredTestParser';
import { TestsDiscoveryService } from '../../client/testing/common/services/discovery';
import { TestCollectionStorageService } from '../../client/testing/common/services/storageService';
import { TestManagerService } from '../../client/testing/common/services/testManagerService';
import { TestResultsService } from '../../client/testing/common/services/testResultsService';
import { TestsStatusUpdaterService } from '../../client/testing/common/services/testsStatusService';
import { ITestDiscoveredTestParser } from '../../client/testing/common/services/types';
import { UnitTestDiagnosticService } from '../../client/testing/common/services/unitTestDiagnosticService';
import { TestsHelper } from '../../client/testing/common/testUtils';
import { TestFlatteningVisitor } from '../../client/testing/common/testVisitors/flatteningVisitor';
import { TestResultResetVisitor } from '../../client/testing/common/testVisitors/resultResetVisitor';
import {
    ITestCollectionStorageService,
    ITestContextService,
    ITestDiagnosticService,
    ITestDiscoveryService,
    ITestManager,
    ITestManagerFactory,
    ITestManagerService,
    ITestManagerServiceFactory,
    ITestResultsService,
    ITestsHelper,
    ITestsParser,
    ITestsStatusUpdaterService,
    ITestVisitor,
    IUnitTestSocketServer,
} from '../../client/testing/common/types';
import { TestManager as NoseTestManager } from '../../client/testing/nosetest/main';
import { TestDiscoveryService as NoseTestDiscoveryService } from '../../client/testing/nosetest/services/discoveryService';
import { TestsParser as NoseTestTestsParser } from '../../client/testing/nosetest/services/parserService';
import { TestManager as PyTestTestManager } from '../../client/testing/pytest/main';
import { TestDiscoveryService as PytestTestDiscoveryService } from '../../client/testing/pytest/services/discoveryService';
import { TestProvider } from '../../client/testing/types';
import { TestManager as UnitTestTestManager } from '../../client/testing/unittest/main';
import { TestDiscoveryService as UnitTestTestDiscoveryService } from '../../client/testing/unittest/services/discoveryService';
import { TestsParser as UnitTestTestsParser } from '../../client/testing/unittest/services/parserService';
import { getPythonSemVer } from '../common';
import { IocContainer } from '../serviceRegistry';
import { MockUnitTestSocketServer } from './mocks';

export class UnitTestIocContainer extends IocContainer {
    public async getPythonMajorVersion(resource: Uri): Promise<number> {
        const procServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        const procService = await procServiceFactory.create(resource);
        const pythonVersion = await getPythonSemVer(procService);
        if (pythonVersion) {
            return pythonVersion.major;
        }
        return -1; // log warning already issued by underlying functions...
    }

    public registerTestVisitors(): void {
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');
        this.serviceManager.addSingleton<ITestsStatusUpdaterService>(
            ITestsStatusUpdaterService,
            TestsStatusUpdaterService,
        );
        this.serviceManager.addSingleton<ITestContextService>(ITestContextService, TestContextService);
    }

    public registerTestStorage(): void {
        this.serviceManager.addSingleton<ITestCollectionStorageService>(
            ITestCollectionStorageService,
            TestCollectionStorageService,
        );
    }

    public registerTestsHelper(): void {
        this.serviceManager.addSingleton<ITestsHelper>(ITestsHelper, TestsHelper);
    }

    public registerTestResultsHelper(): void {
        this.serviceManager.add<ITestResultsService>(ITestResultsService, TestResultsService);
    }

    public registerTestParsers(): void {
        this.serviceManager.add<ITestsParser>(ITestsParser, UnitTestTestsParser, UNITTEST_PROVIDER);
        this.serviceManager.add<ITestsParser>(ITestsParser, NoseTestTestsParser, NOSETEST_PROVIDER);
    }

    public registerTestDiscoveryServices(): void {
        this.serviceManager.add<ITestDiscoveryService>(
            ITestDiscoveryService,
            UnitTestTestDiscoveryService,
            UNITTEST_PROVIDER,
        );
        this.serviceManager.add<ITestDiscoveryService>(
            ITestDiscoveryService,
            PytestTestDiscoveryService,
            PYTEST_PROVIDER,
        );
        this.serviceManager.add<ITestDiscoveryService>(
            ITestDiscoveryService,
            NoseTestDiscoveryService,
            NOSETEST_PROVIDER,
        );
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, TestsDiscoveryService, 'common');
        this.serviceManager.add<ITestDiscoveredTestParser>(ITestDiscoveredTestParser, TestDiscoveredTestParser);
    }

    public registerTestDiagnosticServices(): void {
        this.serviceManager.addSingleton<ITestDiagnosticService>(ITestDiagnosticService, UnitTestDiagnosticService);
    }

    public registerTestManagers(): void {
        this.serviceManager.addFactory<ITestManager>(
            ITestManagerFactory,
            (context) => (testProvider: TestProvider, workspaceFolder: Uri, rootDirectory: string) => {
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
            },
        );
    }

    public registerInterpreterStorageTypes(): void {
        this.serviceManager.add<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
    }

    public registerTestManagerService(): void {
        this.serviceManager.addFactory<ITestManagerService>(
            ITestManagerServiceFactory,
            (context) => (workspaceFolder: Uri) => {
                const serviceContainer = context.container.get<IServiceContainer>(IServiceContainer);
                const testsHelper = context.container.get<ITestsHelper>(ITestsHelper);
                return new TestManagerService(workspaceFolder, testsHelper, serviceContainer);
            },
        );
    }

    public registerMockUnitTestSocketServer(): void {
        this.serviceManager.addSingleton<IUnitTestSocketServer>(IUnitTestSocketServer, MockUnitTestSocketServer);
    }
}
