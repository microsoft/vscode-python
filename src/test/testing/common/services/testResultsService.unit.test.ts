// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { TestResultsService } from '../../../../client/testing/common/services/testResultsService';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    ITestVisitor,
    TestFile,
    TestFolder,
    TestFunction,
    Tests,
    TestStatus,
    TestSuite,
} from '../../../../client/testing/common/types';
import { TestDataItemType } from '../../../../client/testing/types';
import { createMockTestDataItem } from '../testUtils.unit.test';

suite('Unit Tests - Tests Results Service', () => {
    let testResultsService: TestResultsService;
    let resultResetVisitor: typemoq.IMock<ITestVisitor>;
    let tests!: Tests;

    let folder1: TestFolder,
        folder2: TestFolder,
        folder3: TestFolder,
        folder4: TestFolder,
        folder5: TestFolder,
        suite1: TestSuite,
        suite2: TestSuite,
        suite3: TestSuite,
        suite4: TestSuite,
        suite5: TestSuite;
    let file1: TestFile, file2: TestFile, file3: TestFile, file4: TestFile, file5: TestFile;
    setup(() => {
        resultResetVisitor = typemoq.Mock.ofType<ITestVisitor>();
        folder1 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder2 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder3 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder4 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder5 = createMockTestDataItem<TestFolder>(TestDataItemType.folder);
        folder1.folders.push(folder2);
        folder1.folders.push(folder3);
        folder2.folders.push(folder4);
        folder3.folders.push(folder5);

        file1 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        file2 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        file3 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        file4 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        file5 = createMockTestDataItem<TestFile>(TestDataItemType.file);
        folder1.testFiles.push(file1);
        folder3.testFiles.push(file2);
        folder3.testFiles.push(file3);
        folder4.testFiles.push(file5);
        folder5.testFiles.push(file4);

        suite1 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        suite2 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        suite3 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        suite4 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        suite5 = createMockTestDataItem<TestSuite>(TestDataItemType.suite);
        const fn1 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn1.passed = true;
        const fn2 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn2.passed = undefined;
        const fn3 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn3.passed = true;
        const fn4 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn4.passed = false;
        const fn5 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn5.passed = undefined;
        const fn6 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn6.passed = true;
        const fn7 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn7.passed = undefined;
        const fn8 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn8.passed = false;
        const fn9 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn9.passed = true;
        const fn10 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn10.passed = true;
        const fn11 = createMockTestDataItem<TestFunction>(TestDataItemType.function);
        fn11.passed = true;
        file1.suites.push(suite1);
        file1.suites.push(suite2);
        file3.suites.push(suite3);
        suite3.suites.push(suite4);
        suite4.suites.push(suite5);
        file1.functions.push(fn1);
        file1.functions.push(fn2);
        file2.functions.push(fn8);
        file4.functions.push(fn9);
        file4.functions.push(fn11);
        file5.functions.push(fn10);
        suite1.functions.push(fn3);
        suite1.functions.push(fn4);
        suite2.functions.push(fn6);
        suite3.functions.push(fn5);
        suite5.functions.push(fn7);
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
        const flattendFn6: FlattenedTestFunction = {
            testFunction: fn6,
            xmlClassName: fn6.name,
        } as any;
        const flattendFn7: FlattenedTestFunction = {
            testFunction: fn7,
            xmlClassName: fn7.name,
        } as any;
        const flattendFn8: FlattenedTestFunction = {
            testFunction: fn8,
            xmlClassName: fn8.name,
        } as any;
        const flattendFn9: FlattenedTestFunction = {
            testFunction: fn9,
            xmlClassName: fn9.name,
        } as any;
        const flattendFn10: FlattenedTestFunction = {
            testFunction: fn10,
            xmlClassName: fn10.name,
        } as any;
        const flattendFn11: FlattenedTestFunction = {
            testFunction: fn11,
            xmlClassName: fn11.name,
        } as any;
        tests = {
            rootTestFolders: [folder1],
            summary: { errors: 0, skipped: 0, passed: 0, failures: 0 },
            testFiles: [file1, file2, file3, file4, file5],
            testFolders: [folder1, folder2, folder3, folder4, folder5],
            testFunctions: [
                flattendFn1,
                flattendFn2,
                flattendFn3,
                flattendFn4,
                flattendFn5,
                flattendFn6,
                flattendFn7,
                flattendFn8,
                flattendFn9,
                flattendFn10,
                flattendFn11,
            ],
            testSuites: [flattendSuite1, flattendSuite2, flattendSuite3, flattendSuite4, flattendSuite5],
        };
        testResultsService = new TestResultsService(resultResetVisitor.object);
    });

    test('If any test fails, parent fails', () => {
        testResultsService.updateResults(tests);
        expect(suite1.status).to.equal(TestStatus.Fail);
        expect(file1.status).to.equal(TestStatus.Fail);
        expect(folder1.status).to.equal(TestStatus.Fail);
        expect(file2.status).to.equal(TestStatus.Fail);
        expect(folder3.status).to.equal(TestStatus.Fail);
    });

    test('If all tests pass, parent passes', () => {
        testResultsService.updateResults(tests);
        expect(file4.status).to.equal(TestStatus.Pass);
        expect(folder5.status).to.equal(TestStatus.Pass);
        expect(folder2.status).to.equal(TestStatus.Pass);
    });

    test('If no tests run, parent status is not run', () => {
        testResultsService.updateResults(tests);
        expect(suite3.status).to.equal(TestStatus.Unknown);
        expect(suite4.status).to.equal(TestStatus.Unknown);
        expect(suite5.status).to.equal(TestStatus.Unknown);
        expect(file3.status).to.equal(TestStatus.Unknown);
    });

    test('Number of functions passed, not run and failed are correctly calculated', () => {
        testResultsService.updateResults(tests);

        expect(file1.functionsPassed).to.equal(3);
        expect(folder2.functionsPassed).to.equal(1);
        expect(folder3.functionsPassed).to.equal(2);
        expect(folder1.functionsPassed).to.equal(6);

        expect(file1.functionsFailed).to.equal(1);
        expect(folder2.functionsFailed).to.equal(0);
        expect(folder3.functionsFailed).to.equal(1);
        expect(folder1.functionsFailed).to.equal(2);

        expect(file1.functionsDidNotRun).to.equal(1);
        expect(suite4.functionsDidNotRun).to.equal(1);
        expect(suite3.functionsDidNotRun).to.equal(2);
        expect(folder1.functionsDidNotRun).to.equal(3);
    });
});
