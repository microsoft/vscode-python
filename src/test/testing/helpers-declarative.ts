// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import {
    TestFile, TestFolder, TestFunction, TestProvider, TestResult, Tests,
    TestStatus, TestSuite, TestType
} from '../../client/testing/common/types';
import {
    getDedentedLines, getIndent, RESOURCE
} from './helper';
import {
    createEmptyResults, flattenFunction, flattenSuite, nodes, updateSummary
} from './results';

type ParsedTestNode = {
    indent: string;
    name: string;
    testType: TestType;
    result: TestResult;
};

type TestParent = nodes.TestNode & {
    indent: string;
};

// Return a test tree built from concise declarative text.
export function createResults(
    text: string,
    provider: TestProvider = 'pytest',
    resource: Uri = RESOURCE
): Tests {
    const tests = createEmptyResults();

    // Build the tree (and populate the return value at the same time).
    const parents: TestParent[] = [];
    let prev: TestParent;
    for (const line of getDedentedLines(text)) {
        if (line.trim() === '') {
            continue;
        }
        const parsed = parseTestLine(line);

        let node: nodes.TestNode;
        if (isRootNode(parsed)) {
            parents.length = 0;  // Clear the array.
            node = nodes.createFolderResults(
                parsed.name,
                undefined,
                resource
            );
            tests.rootTestFolders.push(node as TestFolder);
            tests.testFolders.push(node as TestFolder);
        } else {
            const parent = setMatchingParent(
                parents,
                prev!,
                parsed.indent
            );
            node = buildDiscoveredChildNode(
                parent,
                parsed.name,
                parsed.testType,
                provider,
                resource
            );
            switch (parsed.testType) {
                case TestType.testFolder:
                    tests.testFolders.push(node as TestFolder);
                    break;
                case TestType.testFile:
                    tests.testFiles.push(node as TestFile);
                    break;
                case TestType.testSuite:
                    tests.testSuites.push(
                        flattenSuite(node as TestSuite, parents)
                    );
                    break;
                case TestType.testFunction:
                    // This does not deal with subtests?
                    tests.testFunctions.push(
                        flattenFunction(node as TestFunction, parents)
                    );
                    break;
                default:
            }
        }

        // Set the result.
        node.status = parsed.result.status;
        node.time = parsed.result.time;
        updateSummary(tests.summary, node.status!);

        // Prepare for the next line.
        prev = node as TestParent;
        prev.indent = parsed.indent;
    }

    return tests;
}

// Determine the kind, indent, and result info based on the line.
function parseTestLine(line: string): ParsedTestNode {
    if (line.includes('\\')) {
        throw Error('expected / as path separator (even on Windows)');
    }

    const indent = getIndent(line);
    line = line.trim();

    const parts = line.split(' ');
    let name = parts.shift();
    if (!name) {
        throw Error('missing name');
    }

    // Determine the type from the name.
    let testType: TestType;
    if (name.endsWith('/')) {
        // folder
        testType = TestType.testFolder;
        while (name.endsWith('/')) {
            name = name.slice(0, -1);
        }
    } else if (name.includes('.')) {
        // file
        if (name.includes('/')) {
            throw Error('filename must not include directories');
        }
        testType = TestType.testFile;
    } else if (name.startsWith('<')) {
        // suite
        if (!name.endsWith('>')) {
            throw Error('suite missing closing bracket');
        }
        testType = TestType.testSuite;
        name = name.slice(1, -1);
    } else {
        // test
        testType = TestType.testFunction;
    }

    // Parse the results.
    const result: TestResult = {
        time: 0
    };
    if (parts.length !== 0 && testType !== TestType.testFunction) {
        throw Error('non-test nodes do not have results');
    }
    switch (parts.length) {
        case 0:
            break;
        case 1:
            // tslint:disable-next-line:no-any
            if (isNaN(parts[0] as any)) {
                throw Error(`expected a time (float), got ${parts[0]}`);
            }
            result.time = parseFloat(parts[0]);
            break;
        case 2:
            switch (parts[0]) {
                case 'P':
                    result.status = TestStatus.Pass;
                    break;
                case 'F':
                    result.status = TestStatus.Fail;
                    break;
                case 'E':
                    result.status = TestStatus.Error;
                    break;
                case 'S':
                    result.status = TestStatus.Skipped;
                    break;
                default:
                    throw Error('expected a status and then a time');
            }
            // tslint:disable-next-line:no-any
            if (isNaN(parts[1] as any)) {
                throw Error(`expected a time (float), got ${parts[1]}`);
            }
            result.time = parseFloat(parts[1]);
            break;
        default:
            throw Error('too many items on line');
    }

    return {
        indent: indent,
        name: name,
        testType: testType,
        result: result
    };
}

function isRootNode(
    parsed: ParsedTestNode
): boolean {
    if (parsed.indent === '') {
        if (parsed.testType !== TestType.testFolder) {
            throw Error('a top-level node must be a folder');
        }
        return true;
    }
    return false;
}

function setMatchingParent(
    parents: TestParent[],
    prev: TestParent,
    parsedIndent: string
): TestParent {
    let current = parents.length > 0 ? parents[parents.length - 1] : prev;
    if (parsedIndent.length > current.indent.length) {
        parents.push(prev);
        current = prev;
    } else {
        while (parsedIndent !== current.indent) {
            if (parsedIndent.length > current.indent.length) {
                throw Error('mis-aligned indentation');
            }

            parents.pop();
            if (parents.length === 0) {
                throw Error('mis-aligned indentation');
            }
            current = parents[parents.length - 1];
        }
    }
    return current;
}

function buildDiscoveredChildNode(
    parent: TestParent,
    name: string,
    testType: TestType,
    provider: TestProvider,
    resource?: Uri
): nodes.TestNode {
    switch (testType) {
        case TestType.testFolder:
            if (parent.testType !== TestType.testFolder) {
                throw Error('parent must be a folder');
            }
            return nodes.addDiscoveredSubFolder(
                parent as TestFolder,
                name,
                undefined,
                resource
            );
        case TestType.testFile:
            if (parent.testType !== TestType.testFolder) {
                throw Error('parent must be a folder');
            }
            return nodes.addDiscoveredFile(
                parent as TestFolder,
                name,
                undefined,
                undefined,
                resource
            );
        case TestType.testSuite:
            let suiteParent: TestFile | TestSuite;
            if (parent.testType === TestType.testFile) {
                suiteParent = parent as TestFile;
            } else if (parent.testType === TestType.testSuite) {
                suiteParent = parent as TestSuite;
            } else {
                throw Error('parent must be a file or suite');
            }
            return nodes.addDiscoveredSuite(
                suiteParent,
                name,
                undefined,
                undefined,
                provider,
                undefined,
                resource
            );
        case TestType.testFunction:
            let funcParent: TestFile | TestSuite;
            if (parent.testType === TestType.testFile) {
                funcParent = parent as TestFile;
            } else if (parent.testType === TestType.testSuite) {
                funcParent = parent as TestSuite;
            } else if (parent.testType === TestType.testFunction) {
                throw Error('not finished: use addDiscoveredSubTest()');
            } else {
                throw Error('parent must be a file, suite, or function');
            }
            return nodes.addDiscoveredTest(
                funcParent,
                name,
                undefined,
                provider,
                resource
            );
        default:
            throw Error('unsupported');
    }
}
