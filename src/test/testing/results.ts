// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { Uri } from 'vscode';
import {
    FlattenedTestFunction,
    FlattenedTestSuite,
    SubtestParent,
    TestFile,
    TestFolder,
    TestFunction,
    TestingType,
    TestProvider,
    TestResult,
    Tests,
    TestStatus,
    TestSuite,
    TestSummary,
} from '../../client/testing/common/types';
import { fixPath, getDedentedLines, getIndent, RESOURCE } from './helper';

type SuperTest = TestFunction & {
    subtests: TestFunction[];
};

export type TestItem = TestFolder | TestFile | TestSuite | SuperTest | TestFunction;

export type TestNode = TestItem & {
    testType: TestingType;
};

// Return an initialized test results.
export function createEmptyResults(): Tests {
    return {
        summary: {
            passed: 0,
            failures: 0,
            errors: 0,
            skipped: 0,
        },
        testFiles: [],
        testFunctions: [],
        testSuites: [],
        testFolders: [],
        rootTestFolders: [],
    };
}

// Increment the appropriate summary property.
export function updateSummary(summary: TestSummary, status: TestStatus) {
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
        if (parent.testType === TestingType.file) {
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
        if (parent.testType === TestingType.suite) {
            return parent as TestSuite;
        }
    }
    return;
}

// Return the "flattened" test suite node.
export function flattenSuite(node: TestSuite, parents: TestNode[]): FlattenedTestSuite {
    const found = findParentFile(parents);
    if (!found) {
        throw Error('parent file not found');
    }
    const parentFile: TestFile = found;
    return {
        testSuite: node,
        parentTestFile: parentFile,
        xmlClassName: node.xmlName,
    };
}

// Return the "flattened" test function node.
export function flattenFunction(node: TestFunction, parents: TestNode[]): FlattenedTestFunction {
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
        xmlClassName: parentSuite ? parentSuite.xmlName : '',
    };
}

// operations on raw test nodes
export namespace nodes {
    // Set the result-oriented properties back to their "unset" values.
    export function resetResult(node: TestNode) {
        node.time = 0;
        node.status = TestStatus.Unknown;
    }

    //********************************
    // builders for empty low-level test results

    export function createFolderResults(dirname: string, nameToRun?: string, resource: Uri = RESOURCE): TestNode {
        dirname = fixPath(dirname);
        return {
            resource: resource,
            name: dirname,
            nameToRun: nameToRun || dirname,
            folders: [],
            testFiles: [],
            testType: TestingType.folder,
            // result
            time: 0,
            status: TestStatus.Unknown,
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
            testType: TestingType.file,
            // result
            time: 0,
            status: TestStatus.Unknown,
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
            nameToRun: nameToRun || '', // must be set for parent
            xmlName: xmlName || '', // must be set for parent
            isUnitTest: provider === 'unittest',
            isInstance: isInstance,
            suites: [],
            functions: [],
            testType: TestingType.suite,
            // result
            time: 0,
            status: TestStatus.Unknown,
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
            testType: TestingType.function,
            // result
            time: 0,
            status: TestStatus.Unknown,
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
        const subFolder = createFolderResults(dirname, nameToRun, resource || parent.resource || RESOURCE);
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
        const file = createFileResults(filename, nameToRun, xmlName, resource || parent.resource || RESOURCE);
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
        const test = createTestResults(name, nameToRun, undefined, resource || parent.resource || RESOURCE);
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
                time: 0,
            },
            resource || parent.resource || RESOURCE
        );
        (subtest as TestFunction).subtestParent!.asSuite.functions.push(subtest);
        parent.subtests.push(subtest as TestFunction);
        return subtest;
    }
}

namespace declarative {
    type TestParent = TestNode & {
        indent: string;
    };

    type ParsedTestNode = {
        indent: string;
        name: string;
        testType: TestingType;
        result: TestResult;
    };

    // Return a test tree built from concise declarative text.
    export function parseResults(text: string, tests: Tests, provider: TestProvider, resource: Uri) {
        // Build the tree (and populate the return value at the same time).
        const parents: TestParent[] = [];
        let prev: TestParent;
        for (const line of getDedentedLines(text)) {
            if (line.trim() === '') {
                continue;
            }
            const parsed = parseTestLine(line);

            let node: TestNode;
            if (isRootNode(parsed)) {
                parents.length = 0; // Clear the array.
                node = nodes.createFolderResults(parsed.name, undefined, resource);
                tests.rootTestFolders.push(node as TestFolder);
                tests.testFolders.push(node as TestFolder);
            } else {
                const parent = setMatchingParent(parents, prev!, parsed.indent);
                node = buildDiscoveredChildNode(parent, parsed.name, parsed.testType, provider, resource);
                switch (parsed.testType) {
                    case TestingType.folder:
                        tests.testFolders.push(node as TestFolder);
                        break;
                    case TestingType.file:
                        tests.testFiles.push(node as TestFile);
                        break;
                    case TestingType.suite:
                        tests.testSuites.push(flattenSuite(node as TestSuite, parents));
                        break;
                    case TestingType.function:
                        // This does not deal with subtests?
                        tests.testFunctions.push(flattenFunction(node as TestFunction, parents));
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
        let testType: TestingType;
        if (name.endsWith('/')) {
            // folder
            testType = TestingType.folder;
            while (name.endsWith('/')) {
                name = name.slice(0, -1);
            }
        } else if (name.includes('.')) {
            // file
            if (name.includes('/')) {
                throw Error('filename must not include directories');
            }
            testType = TestingType.file;
        } else if (name.startsWith('<')) {
            // suite
            if (!name.endsWith('>')) {
                throw Error('suite missing closing bracket');
            }
            testType = TestingType.suite;
            name = name.slice(1, -1);
        } else {
            // test
            testType = TestingType.function;
        }

        // Parse the results.
        const result: TestResult = {
            time: 0,
        };
        if (parts.length !== 0 && testType !== TestingType.function) {
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
            result: result,
        };
    }

    function isRootNode(parsed: ParsedTestNode): boolean {
        if (parsed.indent === '') {
            if (parsed.testType !== TestingType.folder) {
                throw Error('a top-level node must be a folder');
            }
            return true;
        }
        return false;
    }

    function setMatchingParent(parents: TestParent[], prev: TestParent, parsedIndent: string): TestParent {
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
        testType: TestingType,
        provider: TestProvider,
        resource?: Uri
    ): TestNode {
        switch (testType) {
            case TestingType.folder:
                if (parent.testType !== TestingType.folder) {
                    throw Error('parent must be a folder');
                }
                return nodes.addDiscoveredSubFolder(parent as TestFolder, name, undefined, resource);
            case TestingType.file:
                if (parent.testType !== TestingType.folder) {
                    throw Error('parent must be a folder');
                }
                return nodes.addDiscoveredFile(parent as TestFolder, name, undefined, undefined, resource);
            case TestingType.suite:
                let suiteParent: TestFile | TestSuite;
                if (parent.testType === TestingType.file) {
                    suiteParent = parent as TestFile;
                } else if (parent.testType === TestingType.suite) {
                    suiteParent = parent as TestSuite;
                } else {
                    throw Error('parent must be a file or suite');
                }
                return nodes.addDiscoveredSuite(suiteParent, name, undefined, undefined, provider, undefined, resource);
            case TestingType.function:
                let funcParent: TestFile | TestSuite;
                if (parent.testType === TestingType.file) {
                    funcParent = parent as TestFile;
                } else if (parent.testType === TestingType.suite) {
                    funcParent = parent as TestSuite;
                } else if (parent.testType === TestingType.function) {
                    throw Error('not finished: use addDiscoveredSubTest()');
                } else {
                    throw Error('parent must be a file, suite, or function');
                }
                return nodes.addDiscoveredTest(funcParent, name, undefined, provider, resource);
            default:
                throw Error('unsupported');
        }
    }
}

// Return a test tree built from concise declarative text.
export function createDeclaratively(text: string, provider: TestProvider = 'pytest', resource: Uri = RESOURCE): Tests {
    const tests = createEmptyResults();
    declarative.parseResults(text, tests, provider, resource);
    return tests;
}
