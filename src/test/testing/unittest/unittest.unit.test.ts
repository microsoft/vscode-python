// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, capture, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import {
    IConfigurationService,
    IDisposableRegistry,
    IOutputChannel,
    IPythonSettings,
} from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { ArgumentsHelper } from '../../../client/testing/common/argumentsHelper';
import { CommandSource } from '../../../client/testing/common/constants';
import { TestCollectionStorageService } from '../../../client/testing/common/services/storageService';
import { TestResultsService } from '../../../client/testing/common/services/testResultsService';
import { TestsStatusUpdaterService } from '../../../client/testing/common/services/testsStatusService';
import { TestsHelper } from '../../../client/testing/common/testUtils';
import { TestResultResetVisitor } from '../../../client/testing/common/testVisitors/resultResetVisitor';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    ITestResultsService,
    ITestsHelper,
    ITestsStatusUpdaterService,
    TestFile,
    TestFolder,
    TestFunction,
    Tests,
    TestStatus,
    TestSuite,
} from '../../../client/testing/common/types';
import {
    IArgumentsHelper,
    IArgumentsService,
    ITestManagerRunner,
    TestDataItemType,
} from '../../../client/testing/types';
import { TestManager } from '../../../client/testing/unittest/main';
import { TestManagerRunner } from '../../../client/testing/unittest/runner';
import { ArgumentsService } from '../../../client/testing/unittest/services/argsService';
import { MockOutputChannel } from '../../mockClasses';
import { createMockTestDataItem } from '../common/testUtils.unit.test';

// tslint:disable:max-func-body-length no-any
suite('Unit Tests - unittest - run failed tests', () => {
    let testManager: TestManager;
    const workspaceFolder = Uri.file(__dirname);
    let serviceContainer: IServiceContainer;
    let testsHelper: ITestsHelper;
    let testManagerRunner: ITestManagerRunner;
    let tests: Tests;
    function createTestData() {
        const folder1 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder2 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder3 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder4 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        const folder5 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder1.folders.push(folder2);
        folder1.folders.push(folder3);
        folder2.folders.push(folder4);
        folder3.folders.push(folder5);

        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        const file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        folder1.testFiles.push(file1);
        folder3.testFiles.push(file2);
        folder3.testFiles.push(file3);
        folder5.testFiles.push(file4);

        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite3 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite4 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const suite5 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        const fn5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        file1.functions.push(fn1);
        file1.functions.push(fn2);
        suite1.functions.push(fn3);
        suite1.functions.push(fn4);
        suite3.functions.push(fn5);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName,
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName,
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName,
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName,
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName,
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name,
        } as any;
        const flattendFn2: FlattenedTestFunction = {
            testFunction: fn2,
            xmlClassName: fn2.name,
        } as any;
        const flattendFn3: FlattenedTestFunction = {
            testFunction: fn3,
            xmlClassName: fn3.name,
        } as any;
        const flattendFn4: FlattenedTestFunction = {
            testFunction: fn4,
            xmlClassName: fn4.name,
        } as any;
        const flattendFn5: FlattenedTestFunction = {
            testFunction: fn5,
            xmlClassName: fn5.name,
        } as any;
        tests = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [folder1, folder2, folder3, folder4, folder5],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3, flattendFn4, flattendFn5],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5],
        };
    }
    setup(() => {
        createTestData();
        serviceContainer = mock(ServiceContainer);
        testsHelper = mock(TestsHelper);
        testManagerRunner = mock(TestManagerRunner);
        const testStorage = mock(TestCollectionStorageService);
        const workspaceService = mock(WorkspaceService);
        const svcInstance = instance(serviceContainer);
        when(testStorage.getTests(anything())).thenReturn(tests);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn({ name: '', index: 0, uri: workspaceFolder });
        when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
        when(serviceContainer.get<IArgumentsHelper>(IArgumentsHelper)).thenReturn(new ArgumentsHelper());
        when(serviceContainer.get<IArgumentsService>(IArgumentsService, anything())).thenReturn(
            new ArgumentsService(svcInstance)
        );
        when(serviceContainer.get<ITestsHelper>(ITestsHelper)).thenReturn(instance(testsHelper));
        when(serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, anything())).thenReturn(
            instance(testManagerRunner)
        );
        when(serviceContainer.get<ITestsStatusUpdaterService>(ITestsStatusUpdaterService)).thenReturn(
            new TestsStatusUpdaterService(instance(testStorage))
        );
        when(serviceContainer.get<ITestResultsService>(ITestResultsService)).thenReturn(
            new TestResultsService(new TestResultResetVisitor())
        );
        when(serviceContainer.get<IOutputChannel>(IOutputChannel)).thenReturn(instance(mock(MockOutputChannel)));
        when(serviceContainer.get<IOutputChannel>(IOutputChannel)).thenReturn(instance(mock(MockOutputChannel)));
        when(serviceContainer.get<IDisposableRegistry>(IDisposableRegistry)).thenReturn([]);
        const settingsService = mock(ConfigurationService);
        const settings: IPythonSettings = {
            testing: {
                unittestArgs: [],
            },
        } as any;
        when(settingsService.getSettings(anything())).thenReturn(settings);
        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(settingsService));

        testManager = new TestManager(workspaceFolder, workspaceFolder.fsPath, svcInstance);
    });

    test('Run Failed tests', async () => {
        testManager.discoverTests = () => Promise.resolve(tests);
        when(testsHelper.shouldRunAllTests(anything())).thenReturn(false);
        when(testManagerRunner.runTest(anything(), anything(), anything())).thenResolve(undefined as any);
        (testManager as any).tests = tests;
        tests.testFunctions[0].testFunction.status = TestStatus.Fail;
        tests.testFunctions[2].testFunction.status = TestStatus.Fail;

        await testManager.runTest(CommandSource.testExplorer, undefined, true);

        const options = capture(testManagerRunner.runTest).last()[1];
        assert.deepEqual(options.tests, tests);
        assert.equal(options.testsToRun!.testFile!.length, 0);
        assert.equal(options.testsToRun!.testFolder!.length, 0);
        assert.equal(options.testsToRun!.testSuite!.length, 0);
        assert.equal(options.testsToRun!.testFunction!.length, 2);
        assert.deepEqual(options.testsToRun!.testFunction![0], tests.testFunctions[0].testFunction);
        assert.deepEqual(options.testsToRun!.testFunction![1], tests.testFunctions[2].testFunction);
    });
    test('Run All tests', async () => {
        testManager.discoverTests = () => Promise.resolve(tests);
        when(testsHelper.shouldRunAllTests(anything())).thenReturn(false);
        when(testManagerRunner.runTest(anything(), anything(), anything())).thenResolve(undefined as any);
        (testManager as any).tests = tests;

        await testManager.runTest(CommandSource.testExplorer, undefined, true);

        const options = capture(testManagerRunner.runTest).last()[1];
        assert.deepEqual(options.tests, tests);
        assert.equal(options.testsToRun!.testFile!.length, 0);
        assert.equal(options.testsToRun!.testFolder!.length, 0);
        assert.equal(options.testsToRun!.testSuite!.length, 0);
        assert.equal(options.testsToRun!.testFunction!.length, 0);
    });
});
