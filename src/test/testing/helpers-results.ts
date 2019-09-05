// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    FlattenedTestFunction, FlattenedTestSuite, TestFile, TestFunction,
    Tests, TestStatus, TestSuite, TestSummary, TestType
} from '../../client/testing/common/types';
import {
    TestNode
} from './helpers-nodes';

// Return an initialized test results.
export function createEmptyResults(): Tests {
    return {
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
}

// Increment the appropriate summary property.
export function updateSummary(
    summary: TestSummary,
    status: TestStatus
) {
    switch (status) {
        case TestStatus.Pass:
            summary.passed += 1;
            break;
        case TestStatus.Fail:
            summary.failures += 1;
            break;
        case TestStatus.Error:
            summary.errors += 1;
            break;
        case TestStatus.Skipped:
            summary.skipped += 1;
            break;
        default:
            // Do not update the results.
    }
}

// Return the file found walking up the parents, if any.
//
// There should only be one parent file.
export function findParentFile(parents: TestNode[]): TestFile | undefined {
    // Iterate in reverse order.
    for (let i = parents.length; i > 0; i -= 1) {
        const parent = parents[i - 1];
        if (parent.testType === TestType.testFile) {
            return parent as TestFile;
        }
    }
    return;
}

// Return the first suite found walking up the parents, if any.
export function findParentSuite(parents: TestNode[]): TestSuite | undefined {
    // Iterate in reverse order.
    for (let i = parents.length; i > 0; i -= 1) {
        const parent = parents[i - 1];
        if (parent.testType === TestType.testSuite) {
            return parent as TestSuite;
        }
    }
    return;
}

// Return the "flattened" test suite node.
export function flattenSuite(
    node: TestSuite,
    parents: TestNode[]
): FlattenedTestSuite {
    const found = findParentFile(parents);
    if (!found) {
        throw Error('parent file not found');
    }
    const parentFile: TestFile = found;
    return {
        testSuite: node,
        parentTestFile: parentFile,
        xmlClassName: node.xmlName
    };
}

// Return the "flattened" test function node.
export function flattenFunction(
    node: TestFunction,
    parents: TestNode[]
): FlattenedTestFunction {
    const found = findParentFile(parents);
    if (!found) {
        throw Error('parent file not found');
    }
    const parentFile: TestFile = found;
    const parentSuite = findParentSuite(parents);
    return {
        testFunction: node,
        parentTestFile: parentFile,
        parentTestSuite: parentSuite,
        xmlClassName: parentSuite ? parentSuite.xmlName : ''
    };
}
