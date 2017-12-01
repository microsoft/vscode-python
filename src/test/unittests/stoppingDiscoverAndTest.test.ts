// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { Uri } from 'vscode';
import { Product } from '../../client/common/installer';
import { CANCELLATION_REASON, CommandSource, UNITTEST_PROVIDER } from '../../client/unittests/common/constants';
import { ITestDiscoveryService } from '../../client/unittests/common/types';
import { initialize, initializeTest } from '../initialize';
import { MockDiscoveryService, MockTestManagerWithRunningTests } from './mocks';
import { UnitTestIocContainer } from './serviceRegistry';

use(chaiAsPromised);

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
// tslint:disable-next-line:variable-name
const EmptyTests = {
    summary: {
        passed: 0,
        failures: 0,
        errors: 0,
        skipped: 0
    },
    testFiles: [],
    testFunctions: [],
    testSuites: [],
    testFolders: [],
    rootTestFolders: []
};

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Stopping Discovery and Runner', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(() => ioc.dispose());

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();

        ioc.registerTestParsers();
        ioc.registerTestVisitors();
        ioc.registerTestResultsHelper();
        ioc.registerTestStorage();
        ioc.registerTestsHelper();

    }

    test('Running tests should not stop existing discovery', async () => {
        const mockTestManager = new MockTestManagerWithRunningTests(UNITTEST_PROVIDER, Product.unittest, Uri.file(testFilesPath), testFilesPath, ioc.serviceContainer);
        ioc.serviceManager.addSingletonInstance<ITestDiscoveryService>(ITestDiscoveryService, new MockDiscoveryService(mockTestManager.discoveryDeferred.promise), UNITTEST_PROVIDER);

        const discoveryPromise = mockTestManager.discoverTests(CommandSource.auto);
        mockTestManager.discoveryDeferred.resolve(EmptyTests);
        mockTestManager.runTest(CommandSource.ui);

        await expect(discoveryPromise).to.eventually.equal(EmptyTests);
    });

    test('Discovering tests should stop running tests', async () => {
        const mockTestManager = new MockTestManagerWithRunningTests(UNITTEST_PROVIDER, Product.unittest, Uri.file(testFilesPath), testFilesPath, ioc.serviceContainer);
        ioc.serviceManager.addSingletonInstance<ITestDiscoveryService>(ITestDiscoveryService, new MockDiscoveryService(mockTestManager.discoveryDeferred.promise), UNITTEST_PROVIDER);
        mockTestManager.discoveryDeferred.resolve(EmptyTests);
        await mockTestManager.discoverTests(CommandSource.auto);
        const runPromise = mockTestManager.runTest(CommandSource.ui);
        // tslint:disable-next-line:no-string-based-set-timeout
        await new Promise(resolve => setTimeout(resolve, 1000));

        // User manually discovering tests will kill the existing test runner.
        mockTestManager.discoverTests(CommandSource.ui, true, false, true);
        await expect(runPromise).to.eventually.be.rejectedWith(CANCELLATION_REASON);
    });
});
