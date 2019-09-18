// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { Uri } from 'vscode';
import {
    FlattenedTestFunction, FlattenedTestSuite,
    SubtestParent, TestFile, TestFolder, TestFunction, TestProvider,
    Tests, TestStatus, TestSuite, TestSummary, TestType
} from '../../client/testing/common/types';
import { fixPath, RESOURCE } from './helper';

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
export function findParentFile(parents: nodes.TestNode[]): TestFile | undefined {
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
export function findParentSuite(parents: nodes.TestNode[]): TestSuite | undefined {
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
    parents: nodes.TestNode[]
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
    parents: nodes.TestNode[]
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

// operations on raw test nodes
export namespace nodes {
    type SuperTest = TestFunction & {
        subtests: TestFunction[];
    };

    export type TestItem = TestFolder | TestFile | TestSuite | SuperTest | TestFunction;

    export type TestNode = TestItem & {
        testType: TestType;
    };
    // Set the result-oriented properties back to their "unset" values.
    export function resetResult(node: TestNode) {
        node.time = 0;
        node.status = TestStatus.Unknown;
    }

    //********************************
    // builders for empty low-level test results

    export function createFolderResults(
        dirname: string,
        nameToRun?: string,
        resource: Uri = RESOURCE
    ): TestNode {
        dirname = fixPath(dirname);
        return {
            resource: resource,
            name: dirname,
            nameToRun: nameToRun || dirname,
            folders: [],
            testFiles: [],
            testType: TestType.testFolder,
            // result
            time: 0,
            status: TestStatus.Unknown
        };
    }

    export function createFileResults(
        filename: string,
        nameToRun?: string,
        xmlName?: string,
        resource: Uri = RESOURCE
    ): TestNode {
        filename = fixPath(filename);
        if (!xmlName) {
            xmlName = filename
                .replace(/\.[^.]+$/, '')
                .replace(/[\\\/]/, '.')
                .replace(/^[.\\\/]*/, '');
        }
        return {
            resource: resource,
            fullPath: filename,
            name: path.basename(filename),
            nameToRun: nameToRun || filename,
            xmlName: xmlName!,
            suites: [],
            functions: [],
            testType: TestType.testFile,
            // result
            time: 0,
            status: TestStatus.Unknown
        };
    }

    export function createSuiteResults(
        name: string,
        nameToRun?: string,
        xmlName?: string,
        provider: TestProvider = 'pytest',
        isInstance: boolean = false,
        resource: Uri = RESOURCE
    ): TestNode {
        return {
            resource: resource,
            name: name,
            nameToRun: nameToRun || '',  // must be set for parent
            xmlName: xmlName || '',  // must be set for parent
            isUnitTest: provider === 'unittest',
            isInstance: isInstance,
            suites: [],
            functions: [],
            testType: TestType.testSuite,
            // result
            time: 0,
            status: TestStatus.Unknown
        };
    }

    export function createTestResults(
        name: string,
        nameToRun?: string,
        subtestParent?: SubtestParent,
        resource: Uri = RESOURCE
    ): TestNode {
        return {
            resource: resource,
            name: name,
            nameToRun: nameToRun || name,
            subtestParent: subtestParent,
            testType: TestType.testFunction,
            // result
            time: 0,
            status: TestStatus.Unknown
        };
    }

    //********************************
    // adding children to low-level nodes

    export function addDiscoveredSubFolder(
        parent: TestFolder,
        basename: string,
        nameToRun?: string,
        resource?: Uri
    ): TestNode {
        const dirname = path.join(parent.name, fixPath(basename));
        const subFolder = createFolderResults(
            dirname,
            nameToRun,
            resource || parent.resource || RESOURCE
        );
        parent.folders.push(subFolder as TestFolder);
        return subFolder;
    }

    export function addDiscoveredFile(
        parent: TestFolder,
        basename: string,
        nameToRun?: string,
        xmlName?: string,
        resource?: Uri
    ): TestNode {
        const filename = path.join(parent.name, fixPath(basename));
        const file = createFileResults(
            filename,
            nameToRun,
            xmlName,
            resource || parent.resource || RESOURCE
        );
        parent.testFiles.push(file as TestFile);
        return file;
    }

    export function addDiscoveredSuite(
        parent: TestFile | TestSuite,
        name: string,
        nameToRun?: string,
        xmlName?: string,
        provider: TestProvider = 'pytest',
        isInstance?: boolean,
        resource?: Uri
    ): TestNode {
        if (!nameToRun) {
            const sep = provider === 'pytest' ? '::' : '.';
            nameToRun = `${parent.nameToRun}${sep}${name}`;
        }
        const suite = createSuiteResults(
            name,
            nameToRun!,
            xmlName || `${parent.xmlName}.${name}`,
            provider,
            isInstance,
            resource || parent.resource || RESOURCE
        );
        parent.suites.push(suite as TestSuite);
        return suite;
    }

    export function addDiscoveredTest(
        parent: TestFile | TestSuite,
        name: string,
        nameToRun?: string,
        provider: TestProvider = 'pytest',
        resource?: Uri
    ): TestNode {
        if (!nameToRun) {
            const sep = provider === 'pytest' ? '::' : '.';
            nameToRun = `${parent.nameToRun}${sep}${name}`;
        }
        const test = createTestResults(
            name,
            nameToRun,
            undefined,
            resource || parent.resource || RESOURCE
        );
        parent.functions.push(test as TestFunction);
        return test;
    }

    export function addDiscoveredSubtest(
        parent: SuperTest,
        name: string,
        nameToRun?: string,
        provider: TestProvider = 'pytest',
        resource?: Uri
    ): TestNode {
        const subtest = createTestResults(
            name,
            nameToRun!,
            {
                name: parent.name,
                nameToRun: parent.nameToRun,
                asSuite: createSuiteResults(
                    parent.name,
                    parent.nameToRun,
                    '',
                    provider,
                    false,
                    parent.resource
                ) as TestSuite,
                time: 0
            },
            resource || parent.resource || RESOURCE
        );
        (subtest as TestFunction).subtestParent!.asSuite.functions.push(subtest);
        parent.subtests.push(subtest as TestFunction);
        return subtest;
    }
}
