// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { copyDesiredTestResults } from '../../../../client/testing/common/testUtils';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    TestFile,
    TestFolder,
    TestFunction,
    Tests,
    TestStatus,
    TestSuite
} from '../../../../client/testing/common/types';
import { TestDataItemType } from '../../../../client/testing/types';
import { createMockTestDataItem } from '../testUtils.unit.test';

// tslint:disable:no-any max-func-body-length
suite('Unit Tests - Storage Service', () => {
    let testData1: Tests;
    let testData2: Tests;
    setup(() => {
        setupTestData1();
        setupTestData2();
    });

    function setupTestData1() {
        const folder1 = createMockTestDataItem<TestFolder>(TestDataItemType.folder, '1');
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file, '1');
        folder1.testFiles.push(file1);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite, '1');
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite, '2');
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function, '1');
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function, '2');
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function, '3');
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file1.functions.push(fn1);
        suite1.functions.push(fn2);
        suite2.functions.push(fn3);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName
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
        testData1 = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1],
            testFolders: [folder1],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3],
            testSuites: [flattendSuite1, flattendSuite2]
        };
    }

    function setupTestData2() {
        const folder1 = createMockTestDataItem<TestFolder>(TestDataItemType.folder, '1');
        const file1 = createMockTestDataItem<TestFile>(TestDataItemType.file, '1');
        folder1.testFiles.push(file1);
        const suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite, '1');
        const suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite, '2');
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function, '1');
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function, '2');
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function, '3');
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        suite1.functions.push(fn1);
        suite1.functions.push(fn2);
        suite2.functions.push(fn3);
        const flattendSuite1: FlattenedTestSuite = {
            testSuite: suite1,
            xmlClassName: suite1.xmlName
        } as any;
        const flattendSuite2: FlattenedTestSuite = {
            testSuite: suite2,
            xmlClassName: suite2.xmlName
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
        testData2 = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1],
            testFolders: [folder1],
            testFunctions: [flattendFn1, flattendFn2, flattendFn3],
            testSuites: [flattendSuite1, flattendSuite2]
        };
    }

    test('Merge Status from existing tests', () => {
        testData1.testFunctions[0].testFunction.passed = true;
        testData1.testFunctions[1].testFunction.status = TestStatus.Fail;
        testData1.testFunctions[2].testFunction.time = 1234;

        assert.notDeepEqual(testData1.testFunctions[0].testFunction, testData2.testFunctions[0].testFunction);
        assert.notDeepEqual(testData1.testFunctions[1].testFunction, testData2.testFunctions[1].testFunction);
        assert.notDeepEqual(testData1.testFunctions[2].testFunction, testData2.testFunctions[2].testFunction);

        copyDesiredTestResults(testData1, testData2);

        // Function 1 is in a different suite now, hence should not get updated.
        assert.notDeepEqual(testData1.testFunctions[0].testFunction, testData2.testFunctions[0].testFunction);
        assert.deepEqual(testData1.testFunctions[1].testFunction, testData2.testFunctions[1].testFunction);
        assert.deepEqual(testData1.testFunctions[2].testFunction, testData2.testFunctions[2].testFunction);
    });
});
