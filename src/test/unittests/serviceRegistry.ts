// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { IServiceContainer } from '../../client/ioc/types';
import { NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../client/unittests/common/services/storageService';
import { TestManagerService } from '../../client/unittests/common/services/testManagerService';
import { TestResultsService } from '../../client/unittests/common/services/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../client/unittests/common/testVisitors/flatteningVisitor';
import { TestFolderGenerationVisitor } from '../../client/unittests/common/testVisitors/folderGenerationVisitor';
import { TestResultResetVisitor } from '../../client/unittests/common/testVisitors/resultResetVisitor';
import { ITestResultsService, ITestsHelper, ITestsParser,
    ITestVisitor, IUnitTestSocketServer,
    PythonVersionInformation, TestProvider } from '../../client/unittests/common/types';
// tslint:disable-next-line:no-duplicate-imports
import { ITestCollectionStorageService, ITestDiscoveryService, ITestManager, ITestManagerFactory, ITestManagerService, ITestManagerServiceFactory } from '../../client/unittests/common/types';
import { TestManager as NoseTestManager } from '../../client/unittests/nosetest/main';
import { TestDiscoveryService as NoseTestDiscoveryService } from '../../client/unittests/nosetest/services/discoveryService';
import { TestsParser as NoseTestTestsParser } from '../../client/unittests/nosetest/services/parserService';
import { TestManager as PyTestTestManager } from '../../client/unittests/pytest/main';
import { TestDiscoveryService as PytestTestDiscoveryService } from '../../client/unittests/pytest/services/discoveryService';
import { TestsParser as PytestTestsParser } from '../../client/unittests/pytest/services/parserService';
import { TestManager as UnitTestTestManager } from '../../client/unittests/unittest/main';
import { TestDiscoveryService as UnitTestTestDiscoveryService } from '../../client/unittests/unittest/services/discoveryService';
import { TestsParser as UnitTestTestsParser } from '../../client/unittests/unittest/services/parserService';
import { IocContainer } from '../serviceRegistry';
import { MockUnitTestSocketServer } from './mocks';

export class UnitTestIocContainer extends IocContainer {
    constructor() {
        super();
    }
    public getPythonMajorVersion(resource: Uri) {
        return this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource })
            .then(pythonProcess => pythonProcess.exec(['-c', 'import sys;print(sys.version_info[0])'], {}))
            .then(output => parseInt(output.stdout.trim(), 10));
    }

    public getPythonMajorMinorVersionString(resource: Uri): Promise<string> {
        return this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource })
            .then(pythonProcess => pythonProcess.exec(['-c', 'import sys;print("{0}.{1}".format(*sys.version_info[:2]))'], {}))
            .then(output => output.stdout.trim());
    }

    public getPythonMajorMinorVersion(resource: Uri): Promise<PythonVersionInformation> {
        return this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource })
            .then(pythonProcess => pythonProcess.exec(['-c', 'import sys;print("{0}|{1}".format(*sys.version_info[:2]))'], {}))
            .then(output => {
                const versionString: string = output.stdout.trim();
                const versionInfo: string[] = versionString.split('|');
                return {
                    major: parseInt(versionInfo[0].trim(), 10),
                    minor: parseInt(versionInfo[1].trim(), 10)
                };
            });
    }
    public registerTestVisitors() {
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestFolderGenerationVisitor, 'TestFolderGenerationVisitor');
        this.serviceManager.add<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');
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
        this.serviceManager.add<ITestsParser>(ITestsParser, PytestTestsParser, PYTEST_PROVIDER);
        this.serviceManager.add<ITestsParser>(ITestsParser, NoseTestTestsParser, NOSETEST_PROVIDER);
    }

    public registerTestDiscoveryServices() {
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, UnitTestTestDiscoveryService, UNITTEST_PROVIDER);
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, PytestTestDiscoveryService, PYTEST_PROVIDER);
        this.serviceManager.add<ITestDiscoveryService>(ITestDiscoveryService, NoseTestDiscoveryService, NOSETEST_PROVIDER);
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
}
