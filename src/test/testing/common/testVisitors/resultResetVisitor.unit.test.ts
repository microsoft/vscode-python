// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { TestResultResetVisitor } from '../../../../client/testing/common/testVisitors/resultResetVisitor';
import { TestStatus } from '../../../../client/testing/common/types';

// tslint:disable-next-line: max-func-body-length
suite('Result reset visitor', async () => {
    let resultResetVisitor: TestResultResetVisitor;
    setup(() => {
        resultResetVisitor = new TestResultResetVisitor();
    });

    test('Method visitTestFunction() resets visited function nodes', async () => {
        const testFunction = {
            passed: true,
            time: 102,
            message: 'yo',
            traceback: 'sd',
            status: TestStatus.Fail,
            functionsDidNotRun: 12,
            functionsPassed: 1,
            functionsFailed: 5,
        };
        const expectedTestFunction = {
            passed: undefined,
            time: 0,
            message: '',
            traceback: '',
            status: TestStatus.Unknown,
            functionsDidNotRun: 0,
            functionsPassed: 0,
            functionsFailed: 0,
        };
        // tslint:disable-next-line: no-any
        resultResetVisitor.visitTestFunction(testFunction as any);
        // tslint:disable-next-line: no-any
        assert.deepEqual(testFunction, expectedTestFunction as any);
    });

    test('Method visitTestSuite() resets visited suite nodes', async () => {
        const testSuite = {
            passed: true,
            time: 102,
            status: TestStatus.Fail,
            functionsDidNotRun: 12,
            functionsPassed: 1,
            functionsFailed: 5,
        };
        const expectedTestSuite = {
            passed: undefined,
            time: 0,
            status: TestStatus.Unknown,
            functionsDidNotRun: 0,
            functionsPassed: 0,
            functionsFailed: 0,
        };
        // tslint:disable-next-line: no-any
        resultResetVisitor.visitTestSuite(testSuite as any);
        // tslint:disable-next-line: no-any
        assert.deepEqual(testSuite, expectedTestSuite as any);
    });

    test('Method visitTestFile() resets visited file nodes', async () => {
        const testFile = {
            passed: true,
            time: 102,
            status: TestStatus.Fail,
            functionsDidNotRun: 12,
            functionsPassed: 1,
            functionsFailed: 5,
        };
        const expectedTestFile = {
            passed: undefined,
            time: 0,
            status: TestStatus.Unknown,
            functionsDidNotRun: 0,
            functionsPassed: 0,
            functionsFailed: 0,
        };
        // tslint:disable-next-line: no-any
        resultResetVisitor.visitTestFile(testFile as any);
        // tslint:disable-next-line: no-any
        assert.deepEqual(testFile, expectedTestFile as any);
    });

    test('Method visitTestFolder() resets visited folder nodes', async () => {
        const testFolder = {
            passed: true,
            time: 102,
            status: TestStatus.Fail,
            functionsDidNotRun: 12,
            functionsPassed: 1,
            functionsFailed: 5,
        };
        const expectedTestFolder = {
            passed: undefined,
            time: 0,
            status: TestStatus.Unknown,
            functionsDidNotRun: 0,
            functionsPassed: 0,
            functionsFailed: 0,
        };
        // tslint:disable-next-line: no-any
        resultResetVisitor.visitTestFolder(testFolder as any);
        // tslint:disable-next-line: no-any
        assert.deepEqual(testFolder, expectedTestFolder as any);
    });
});
