// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { Product } from '../../client/common/installer';
import { CANCELLATION_REASON, CommandSource } from '../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../client/unittests/common/storageService';
import { TestResultsService } from '../../client/unittests/common/testResultsService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestResultsService, ITestsHelper } from '../../client/unittests/common/types';
import { TestResultDisplay } from '../../client/unittests/display/main';
import { initialize, initializeTest } from '../initialize';
import { MockOutputChannel } from '../mockClasses';
import { MockTestManagerWithRunningTests } from './mocks';

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
    let testResultDisplay: TestResultDisplay;
    let outChannel: MockOutputChannel;
    let storageService: ITestCollectionStorageService;
    let resultsService: ITestResultsService;
    let testsHelper: ITestsHelper;
    suiteSetup(initialize);
    setup(async () => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        await initializeTest();
    });
    teardown(() => {
        outChannel.dispose();
        testResultDisplay.dispose();
    });

    function createTestManagerDepedencies() {
        storageService = new TestCollectionStorageService();
        resultsService = new TestResultsService();
        testsHelper = new TestsHelper();
    }

    test('Running tests should not stop existing discovery', async () => {
        createTestManagerDepedencies();
        const mockTestManager = new MockTestManagerWithRunningTests('unittest', Product.unittest, testFilesPath, outChannel, storageService, resultsService, testsHelper);
        const discoveryPromise = mockTestManager.discoverTests(CommandSource.auto);
        mockTestManager.discoveryDeferred.resolve(EmptyTests);
        // tslint:disable-next-line:no-floating-promises
        mockTestManager.runTest(CommandSource.ui);

        await expect(discoveryPromise).to.eventually.equal(EmptyTests);
    });

    test('Discovering tests should stop running tests', async () => {
        createTestManagerDepedencies();
        const mockTestManager = new MockTestManagerWithRunningTests('unittest', Product.unittest, testFilesPath, outChannel, storageService, resultsService, testsHelper);
        mockTestManager.discoveryDeferred.resolve(EmptyTests);
        await mockTestManager.discoverTests(CommandSource.auto);
        const runPromise = mockTestManager.runTest(CommandSource.ui);
        // tslint:disable-next-line:no-string-based-set-timeout
        await new Promise(resolve => setTimeout(resolve, 1000));

        // User manually discovering tests will kill the existing test runner.
        // tslint:disable-next-line:no-floating-promises
        mockTestManager.discoverTests(CommandSource.ui, true, false, true);
        await expect(runPromise).to.eventually.be.rejectedWith(CANCELLATION_REASON);
    });
});
