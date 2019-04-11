// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Uri } from 'vscode';

import { IProcessServiceFactory } from '../../client/common/process/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { History } from '../../client/datascience/history/history';
import { HistoryProvider } from '../../client/datascience/history/historyProvider';
import { JupyterExecutionFactory } from '../../client/datascience/jupyter/jupyterExecutionFactory';
import { JupyterImporter } from '../../client/datascience/jupyter/jupyterImporter';
import { JupyterServerFactory } from '../../client/datascience/jupyter/jupyterServerFactory';
import {
    ICodeCssGenerator,
    IHistory,
    IHistoryProvider,
    IJupyterExecution,
    INotebookImporter,
    INotebookServer
} from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../client/unittests/common/constants';
import { TestContextService } from '../../client/unittests/common/services/contextService';
import { TestDiscoveredTestParser } from '../../client/unittests/common/services/discoveredTestParser';
import { TestsDiscoveryService } from '../../client/unittests/common/services/discovery';
import { TestCollectionStorageService } from '../../client/unittests/common/services/storageService';
import { TestManagerService } from '../../client/unittests/common/services/testManagerService';
import { TestResultsService } from '../../client/unittests/common/services/testResultsService';
import { TestsStatusUpdaterService } from '../../client/unittests/common/services/testsStatusService';
import { ITestDiscoveredTestParser } from '../../client/unittests/common/services/types';
import { UnitTestDiagnosticService } from '../../client/unittests/common/services/unitTestDiagnosticService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../client/unittests/common/testVisitors/flatteningVisitor';
import { TestResultResetVisitor } from '../../client/unittests/common/testVisitors/resultResetVisitor';
import {
    ITestCollectionStorageService,
    ITestContextService,
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
    TestProvider
} from '../../client/unittests/common/types';
import { TestManager as NoseTestManager } from '../../client/unittests/nosetest/main';
import { TestDiscoveryService as NoseTestDiscoveryService } from '../../client/unittests/nosetest/services/discoveryService';
import { TestsParser as NoseTestTestsParser } from '../../client/unittests/nosetest/services/parserService';
import { TestManager as PyTestTestManager } from '../../client/unittests/pytest/main';
import { TestDiscoveryService as PytestTestDiscoveryService } from '../../client/unittests/pytest/services/discoveryService';
import { ITestDiagnosticService } from '../../client/unittests/types';
import { TestManager as UnitTestTestManager } from '../../client/unittests/unittest/main';
import {
    TestDiscoveryService as UnitTestTestDiscoveryService
} from '../../client/unittests/unittest/services/discoveryService';
import { TestsParser as UnitTestTestsParser } from '../../client/unittests/unittest/services/parserService';
import { getPythonSemVer } from '../common';
import { IocContainer } from '../serviceRegistry';
import { MockUnitTestSocketServer } from './mocks';

export class UnitTestIocContainer extends IocContainer {
    constructor() {
        super();
    }
    public async getPythonMajorVersion(resource: Uri): Promise<number> {
        const procServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        const procService = await procServiceFactory.create(resource);
        const pythonVersion = await getPythonSemVer(procService);
        if (pythonVersion) {
            return pythonVersion.major;
        } else {
            return -1; // log warning already issued by underlying functions...
        }
    }

    public registerTestVisitors() {
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');
        this.serviceManager.addSingleton<ITestsStatusUpdaterService>(ITestsStatusUpdaterService, TestsStatusUpdaterService);
        this.serviceManager.addSingleton<ITestContextService>(ITestContextService, TestContextService);
    }

    public registerTestStorage() {
        this.serviceManager.addSingleton<ITestCollectionStorageService>(ITestCollectionStorageService, TestCollectionStorageService);
    }

    public registerTestsHelper() {
        this.serviceManager.addSingleton<ITestsHelper>(ITestsHelper, TestsHelper);
    }

    public registerTestResultsHelper() {
        this.serviceManager.add<ITestResultsService>(ITestResultsService, TestResultsService);
    }

    public registerTestParsers() {
        this.serviceManager.add<ITestsParser>(ITestsParser, UnitTestTestsParser, UNITTEST_PROVIDER);
        this.serviceManager.add<ITestsParser>(ITestsParser, NoseTestTestsParser, NOSETEST_PROVIDER);
    }

    public registerTestDiscoveryServices() {
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, UnitTestTestDiscoveryService, UNITTEST_PROVIDER);
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, PytestTestDiscoveryService, PYTEST_PROVIDER);
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, NoseTestDiscoveryService, NOSETEST_PROVIDER);
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, TestsDiscoveryService, 'common');
        this.serviceManager.add<ITestDiscoveredTestParser>(ITestDiscoveredTestParser, TestDiscoveredTestParser);
    }

    public registerTestDiagnosticServices() {
        this.serviceManager.addSingleton<ITestDiagnosticService>(ITestDiagnosticService, UnitTestDiagnosticService);
    }

    public registerTestManagers() {
        this.serviceManager.addFactory<ITestManager>(ITestManagerFactory, (context) => {
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
    }

    public registerTestManagerService() {
        this.serviceManager.addFactory<ITestManagerService>(ITestManagerServiceFactory, (context) => {
            return (workspaceFolder: Uri) => {
                const serviceContainer = context.container.get<IServiceContainer>(IServiceContainer);
                const testsHelper = context.container.get<ITestsHelper>(ITestsHelper);
                return new TestManagerService(workspaceFolder, testsHelper, serviceContainer);
            };
        });
    }

    public registerMockUnitTestSocketServer() {
        this.serviceManager.addSingleton<IUnitTestSocketServer>(IUnitTestSocketServer, MockUnitTestSocketServer);
    }

    public registerDataScienceTypes() {
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
        this.serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
        this.serviceManager.add<IHistory>(IHistory, History);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServerFactory);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
    }
}
