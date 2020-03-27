// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { TestCollectionStorageService } from '../../../../client/testing/common/services/storageService';
import { TestsStatusUpdaterService } from '../../../../client/testing/common/services/testsStatusService';
import { visitRecursive } from '../../../../client/testing/common/testVisitors/visitor';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    ITestCollectionStorageService,
    ITestsStatusUpdaterService,
    TestFile,
    TestFolder,
    TestFunction,
    Tests,
    TestStatus,
    TestSuite
} from '../../../../client/testing/common/types';
import { TestDataItem, TestDataItemType } from '../../../../client/testing/types';
import { createMockTestDataItem } from '../testUtils.unit.test';

// tslint:disable:no-any max-func-body-length
suite('Unit Tests - Tests Status Updater', () => {
    let storage: ITestCollectionStorageService;
    let updater: ITestsStatusUpdaterService;
    const workspaceUri = Uri.file(__filename);
    let tests!: Tests;
    setup(() => {
        storage = mock(TestCollectionStorageService);
        updater = new TestsStatusUpdaterService(instance(storage));
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
            xmlClassName: suite1.xmlName
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName
        } as any;
        const flattendSuite3: FlattenedTestSuite = {
            testSuite: suite3,
            xmlClassName: suite3.xmlName
        } as any;
        const flattendSuite4: FlattenedTestSuite = {
            testSuite: suite4,
            xmlClassName: suite4.xmlName
        } as any;
        const flattendSuite5: FlattenedTestSuite = {
            testSuite: suite5,
            xmlClassName: suite5.xmlName
        } as any;
        const flattendFn1: FlattenedTestFunction = {
            testFunction: fn1,
            xmlClassName: fn1.name
        } as any;
        const flattendFn2: FlattenedTestFunction = {
            testFunction: fn2,
            xmlClassName: fn2.name
        } as any;
        const flattendFn3: FlattenedTestFunction = {
            testFunction: fn3,
            xmlClassName: fn3.name
        } as any;
        const flattendFn4: FlattenedTestFunction = {
            testFunction: fn4,
            xmlClassName: fn4.name
        } as any;
        const flattendFn5: FlattenedTestFunction = {
            testFunction: fn5,
            xmlClassName: fn5.name
        } as any;
        tests = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4],
            testFolders: [folder1, folder2, folder3, folder4, folder5],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3, flattendFn4, flattendFn5],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5]
        };
        when(storage.getTests(workspaceUri)).thenReturn(tests);
    });

    test('Updating discovery status will recursively update all items and triggers an update for each', () => {
        updater.updateStatusAsDiscovering(workspaceUri, tests);

        function validate(item: TestDataItem) {
            assert.equal(item.status, TestStatus.Discovering);
            verify(storage.update(workspaceUri, item)).once();
        }
        tests.testFolders.forEach(validate);
        tests.testFiles.forEach(validate);
        tests.testFunctions.forEach((func) => validate(func.testFunction));
        tests.testSuites.forEach((suite) => validate(suite.testSuite));
    });
    test('Updating unknown status will recursively update all items and triggers an update for each', () => {
        updater.updateStatusAsUnknown(workspaceUri, tests);

        function validate(item: TestDataItem) {
            assert.equal(item.status, TestStatus.Unknown);
            verify(storage.update(workspaceUri, item)).once();
        }
        tests.testFolders.forEach(validate);
        tests.testFiles.forEach(validate);
        tests.testFunctions.forEach((func) => validate(func.testFunction));
        tests.testSuites.forEach((suite) => validate(suite.testSuite));
    });
    test('Updating running status will recursively update all items and triggers an update for each', () => {
        updater.updateStatusAsRunning(workspaceUri, tests);

        function validate(item: TestDataItem) {
            assert.equal(item.status, TestStatus.Running);
            verify(storage.update(workspaceUri, item)).once();
        }
        tests.testFolders.forEach(validate);
        tests.testFiles.forEach(validate);
        tests.testFunctions.forEach((func) => validate(func.testFunction));
        tests.testSuites.forEach((suite) => validate(suite.testSuite));
    });
    test('Updating running status for failed tests will recursively update all items and triggers an update for each', () => {
        tests.testFolders[1].status = TestStatus.Fail;
        tests.testFolders[2].status = TestStatus.Error;
        tests.testFiles[2].status = TestStatus.Fail;
        tests.testFiles[3].status = TestStatus.Error;
        tests.testFunctions[2].testFunction.status = TestStatus.Fail;
        tests.testFunctions[3].testFunction.status = TestStatus.Error;
        tests.testFunctions[4].testFunction.status = TestStatus.Pass;
        tests.testSuites[1].testSuite.status = TestStatus.Fail;
        tests.testSuites[2].testSuite.status = TestStatus.Error;

        updater.updateStatusAsRunningFailedTests(workspaceUri, tests);

        // Do not update status of folders and files.
        assert.equal(tests.testFolders[1].status, TestStatus.Fail);
        assert.equal(tests.testFolders[2].status, TestStatus.Error);
        assert.equal(tests.testFiles[2].status, TestStatus.Fail);
        assert.equal(tests.testFiles[3].status, TestStatus.Error);

        // Update status of test functions and suites.
        const updatedItems: TestDataItem[] = [];
        const visitor = (item: TestDataItem) => {
            if (item.status && item.status !== TestStatus.Pass) {
                updatedItems.push(item);
            }
        };
        const failedItems = [
            tests.testFunctions[2].testFunction,
            tests.testFunctions[3].testFunction,
            tests.testSuites[1].testSuite,
            tests.testSuites[2].testSuite
        ];
        failedItems.forEach((failedItem) => visitRecursive(tests, failedItem, visitor));

        for (const item of updatedItems) {
            assert.equal(item.status, TestStatus.Running);
            verify(storage.update(workspaceUri, item)).once();
        }

        // Only items with status Fail & Error should be modified
        assert.equal(tests.testFunctions[4].testFunction.status, TestStatus.Pass);

        // Should only be called for failed items.
        verify(storage.update(workspaceUri, anything())).times(updatedItems.length);
    });
    test('Updating idle status for runnings tests will recursively update all items and triggers an update for each', () => {
        tests.testFolders[1].status = TestStatus.Running;
        tests.testFolders[2].status = TestStatus.Running;
        tests.testFiles[2].status = TestStatus.Running;
        tests.testFiles[3].status = TestStatus.Running;
        tests.testFunctions[2].testFunction.status = TestStatus.Running;
        tests.testFunctions[3].testFunction.status = TestStatus.Running;
        tests.testSuites[1].testSuite.status = TestStatus.Running;
        tests.testSuites[2].testSuite.status = TestStatus.Running;

        updater.updateStatusOfRunningTestsAsIdle(workspaceUri, tests);

        const updatedItems: TestDataItem[] = [];
        updatedItems.push(tests.testFolders[1]);
        updatedItems.push(tests.testFolders[2]);
        updatedItems.push(tests.testFiles[2]);
        updatedItems.push(tests.testFiles[3]);
        updatedItems.push(tests.testFunctions[2].testFunction);
        updatedItems.push(tests.testFunctions[3].testFunction);
        updatedItems.push(tests.testSuites[1].testSuite);
        updatedItems.push(tests.testSuites[2].testSuite);

        for (const item of updatedItems) {
            assert.equal(item.status, TestStatus.Idle);
            verify(storage.update(workspaceUri, item)).once();
        }

        // Should only be called for failed items.
        verify(storage.update(workspaceUri, anything())).times(updatedItems.length);
    });
    test('Triggers an update for each', () => {
        updater.triggerUpdatesToTests(workspaceUri, tests);

        const updatedItems: TestDataItem[] = [
            ...tests.testFolders,
            ...tests.testFiles,
            ...tests.testFunctions.map((item) => item.testFunction),
            ...tests.testSuites.map((item) => item.testSuite)
        ];

        for (const item of updatedItems) {
            verify(storage.update(workspaceUri, item)).once();
        }

        verify(storage.update(workspaceUri, anything())).times(updatedItems.length);
    });
});
