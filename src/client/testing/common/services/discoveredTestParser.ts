// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { TestDataItem, TestDataItemType } from '../../types';
import { getParentFile, getParentSuite, getTestDataItemType } from '../testUtils';
import * as testing from '../types';
import * as discovery from './types';

@injectable()
export class TestDiscoveredTestParser implements discovery.ITestDiscoveredTestParser {
    constructor(@inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) {}

    public parse(resource: Uri, discoveredTests: discovery.DiscoveredTests[]): testing.Tests {
        const tests: testing.Tests = {
            rootTestFolders: [],
            summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
            testFiles: [],
            testFolders: [],
            testFunctions: [],
            testSuites: []
        };

        const workspace = this.workspaceService.getWorkspaceFolder(resource);
        if (!workspace) {
            traceError('Resource does not belong to any workspace folder');
            return tests;
        }

        for (const data of discoveredTests) {
            const rootFolder = {
                name: data.root,
                folders: [],
                time: 0,
                testFiles: [],
                resource: resource,
                nameToRun: data.rootid
            };
            tests.rootTestFolders.push(rootFolder);
            tests.testFolders.push(rootFolder);
            this.buildChildren(rootFolder, rootFolder, data, tests);
        }

        return tests;
    }

    /**
     * Not the best solution to use `case statements`, but it keeps the code simple and easy to read in one place.
     * Could go with separate classes for each type and use stratergies, but that just ends up a class for
     * 10 lines of code. Hopefully this is more readable and maintainable than having multiple classes for
     * the simple processing of the children.
     *
     * @protected
     * @param {TestFolder} rootFolder
     * @param {TestDataItem} parent
     * @param {DiscoveredTests} discoveredTests
     * @param {Tests} tests
     * @memberof TestsDiscovery
     */
    public buildChildren(
        rootFolder: testing.TestFolder,
        parent: TestDataItem,
        discoveredTests: discovery.DiscoveredTests,
        tests: testing.Tests
    ) {
        const parentType = getTestDataItemType(parent);
        switch (parentType) {
            case TestDataItemType.folder: {
                this.processFolder(rootFolder, parent as testing.TestFolder, discoveredTests, tests);
                break;
            }
            case TestDataItemType.file: {
                this.processFile(rootFolder, parent as testing.TestFile, discoveredTests, tests);
                break;
            }
            case TestDataItemType.suite: {
                this.processSuite(rootFolder, parent as testing.TestSuite, discoveredTests, tests);
                break;
            }
            default:
                break;
        }
    }

    /**
     * Process the children of a folder.
     * A folder can only contain other folders and files.
     * Hence limit processing to those items.
     *
     * @protected
     * @param {TestFolder} rootFolder
     * @param {TestFolder} parentFolder
     * @param {DiscoveredTests} discoveredTests
     * @param {Tests} tests
     * @memberof TestDiscoveredTestParser
     */
    protected processFolder(
        rootFolder: testing.TestFolder,
        parentFolder: testing.TestFolder,
        discoveredTests: discovery.DiscoveredTests,
        tests: testing.Tests
    ) {
        const folders = discoveredTests.parents
            .filter((child) => child.kind === 'folder' && child.parentid === parentFolder.nameToRun)
            .map((folder) => createTestFolder(rootFolder, folder as discovery.TestFolder));
        folders.forEach((folder) => {
            parentFolder.folders.push(folder);
            tests.testFolders.push(folder);
            this.buildChildren(rootFolder, folder, discoveredTests, tests);
        });

        const files = discoveredTests.parents
            .filter((child) => child.kind === 'file' && child.parentid === parentFolder.nameToRun)
            .map((file) => createTestFile(rootFolder, file as discovery.TestFile));
        files.forEach((file) => {
            parentFolder.testFiles.push(file);
            tests.testFiles.push(file);
            this.buildChildren(rootFolder, file, discoveredTests, tests);
        });
    }

    /**
     * Process the children of a file.
     * A file can only contain suites, functions and paramerterized functions.
     * Hence limit processing just to those items.
     *
     * @protected
     * @param {TestFolder} rootFolder
     * @param {TestFile} parentFile
     * @param {DiscoveredTests} discoveredTests
     * @param {Tests} tests
     * @memberof TestDiscoveredTestParser
     */
    protected processFile(
        rootFolder: testing.TestFolder,
        parentFile: testing.TestFile,
        discoveredTests: discovery.DiscoveredTests,
        tests: testing.Tests
    ) {
        const suites = discoveredTests.parents
            .filter((child) => child.kind === 'suite' && child.parentid === parentFile.nameToRun)
            .map((suite) => createTestSuite(parentFile, rootFolder.resource, suite as discovery.TestSuite));
        suites.forEach((suite) => {
            parentFile.suites.push(suite);
            tests.testSuites.push(createFlattenedSuite(tests, suite));
            this.buildChildren(rootFolder, suite, discoveredTests, tests);
        });

        const functions = discoveredTests.tests
            .filter((test) => test.parentid === parentFile.nameToRun)
            .map((test) => createTestFunction(rootFolder, test));
        functions.forEach((func) => {
            parentFile.functions.push(func);
            tests.testFunctions.push(createFlattenedFunction(tests, func));
        });

        const parameterizedFunctions = discoveredTests.parents
            .filter((child) => child.kind === 'function' && child.parentid === parentFile.nameToRun)
            .map((func) => createParameterizedTestFunction(rootFolder, func as discovery.TestFunction));
        parameterizedFunctions.forEach((func) =>
            this.processParameterizedFunction(rootFolder, parentFile, func, discoveredTests, tests)
        );
    }

    /**
     * Process the children of a suite.
     * A suite can only contain suites, functions and paramerterized functions.
     * Hence limit processing just to those items.
     *
     * @protected
     * @param {TestFolder} rootFolder
     * @param {TestSuite} parentSuite
     * @param {DiscoveredTests} discoveredTests
     * @param {Tests} tests
     * @memberof TestDiscoveredTestParser
     */
    protected processSuite(
        rootFolder: testing.TestFolder,
        parentSuite: testing.TestSuite,
        discoveredTests: discovery.DiscoveredTests,
        tests: testing.Tests
    ) {
        const suites = discoveredTests.parents
            .filter((child) => child.kind === 'suite' && child.parentid === parentSuite.nameToRun)
            .map((suite) => createTestSuite(parentSuite, rootFolder.resource, suite as discovery.TestSuite));
        suites.forEach((suite) => {
            parentSuite.suites.push(suite);
            tests.testSuites.push(createFlattenedSuite(tests, suite));
            this.buildChildren(rootFolder, suite, discoveredTests, tests);
        });

        const functions = discoveredTests.tests
            .filter((test) => test.parentid === parentSuite.nameToRun)
            .map((test) => createTestFunction(rootFolder, test));
        functions.forEach((func) => {
            parentSuite.functions.push(func);
            tests.testFunctions.push(createFlattenedFunction(tests, func));
        });

        const parameterizedFunctions = discoveredTests.parents
            .filter((child) => child.kind === 'function' && child.parentid === parentSuite.nameToRun)
            .map((func) => createParameterizedTestFunction(rootFolder, func as discovery.TestFunction));
        parameterizedFunctions.forEach((func) =>
            this.processParameterizedFunction(rootFolder, parentSuite, func, discoveredTests, tests)
        );
    }

    /**
     * Process the children of a parameterized function.
     * A parameterized function can only contain functions (in tests).
     * Hence limit processing just to those items.
     *
     * @protected
     * @param {TestFolder} rootFolder
     * @param {TestFile | TestSuite} parent
     * @param {TestFunction} parentFunction
     * @param {DiscoveredTests} discoveredTests
     * @param {Tests} tests
     * @returns
     * @memberof TestDiscoveredTestParser
     */
    protected processParameterizedFunction(
        rootFolder: testing.TestFolder,
        parent: testing.TestFile | testing.TestSuite,
        parentFunction: testing.SubtestParent,
        discoveredTests: discovery.DiscoveredTests,
        tests: testing.Tests
    ) {
        if (!parentFunction.asSuite) {
            return;
        }
        const functions = discoveredTests.tests
            .filter((test) => test.parentid === parentFunction.nameToRun)
            .map((test) => createTestFunction(rootFolder, test));
        functions.forEach((func) => {
            func.subtestParent = parentFunction;
            parentFunction.asSuite.functions.push(func);
            parent.functions.push(func);
            tests.testFunctions.push(createFlattenedParameterizedFunction(tests, func, parent));
        });
    }
}

function createTestFolder(root: testing.TestFolder, item: discovery.TestFolder): testing.TestFolder {
    return {
        name: item.name,
        nameToRun: item.id,
        resource: root.resource,
        time: 0,
        folders: [],
        testFiles: []
    };
}

function createTestFile(root: testing.TestFolder, item: discovery.TestFile): testing.TestFile {
    const fullpath = path.isAbsolute(item.relpath) ? item.relpath : path.resolve(root.name, item.relpath);
    return {
        fullPath: fullpath,
        functions: [],
        name: item.name,
        nameToRun: item.id,
        resource: root.resource,
        suites: [],
        time: 0,
        xmlName: createXmlName(item.id)
    };
}

function createTestSuite(
    parentSuiteFile: testing.TestFile | testing.TestSuite,
    resource: Uri,
    item: discovery.TestSuite
): testing.TestSuite {
    const suite = {
        functions: [],
        name: item.name,
        nameToRun: item.id,
        resource: resource,
        suites: [],
        time: 0,
        xmlName: '',
        isInstance: false,
        isUnitTest: false
    };
    suite.xmlName = `${parentSuiteFile.xmlName}.${item.name}`;
    return suite;
}

function createFlattenedSuite(tests: testing.Tests, suite: testing.TestSuite): testing.FlattenedTestSuite {
    const parentFile = getParentFile(tests, suite);
    return {
        parentTestFile: parentFile,
        testSuite: suite,
        xmlClassName: parentFile.xmlName
    };
}

function createFlattenedParameterizedFunction(
    tests: testing.Tests,
    func: testing.TestFunction,
    parent: testing.TestFile | testing.TestSuite
): testing.FlattenedTestFunction {
    const type = getTestDataItemType(parent);
    const parentFile =
        type && type === TestDataItemType.suite ? getParentFile(tests, func) : (parent as testing.TestFile);
    const parentSuite = type && type === TestDataItemType.suite ? (parent as testing.TestSuite) : undefined;
    return {
        parentTestFile: parentFile,
        parentTestSuite: parentSuite,
        xmlClassName: parentSuite ? parentSuite.xmlName : parentFile.xmlName,
        testFunction: func
    };
}

function createFlattenedFunction(tests: testing.Tests, func: testing.TestFunction): testing.FlattenedTestFunction {
    const parent = getParentFile(tests, func);
    const type = parent ? getTestDataItemType(parent) : undefined;
    const parentFile =
        type && type === TestDataItemType.suite ? getParentFile(tests, func) : (parent as testing.TestFile);
    const parentSuite = getParentSuite(tests, func);
    return {
        parentTestFile: parentFile,
        parentTestSuite: parentSuite,
        xmlClassName: parentSuite ? parentSuite.xmlName : parentFile.xmlName,
        testFunction: func
    };
}

function createParameterizedTestFunction(
    root: testing.TestFolder,
    item: discovery.TestFunction
): testing.SubtestParent {
    const suite: testing.TestSuite = {
        functions: [],
        isInstance: false,
        isUnitTest: false,
        name: item.name,
        nameToRun: item.id,
        resource: root.resource,
        time: 0,
        suites: [],
        xmlName: ''
    };
    return {
        asSuite: suite,
        name: item.name,
        nameToRun: item.id,
        time: 0
    };
}

function createTestFunction(root: testing.TestFolder, item: discovery.Test): testing.TestFunction {
    return {
        name: item.name,
        nameToRun: item.id,
        resource: root.resource,
        time: 0,
        file: item.source.substr(0, item.source.lastIndexOf(':'))
    };
}

/**
 * Creates something known as an Xml Name, used to identify items
 * from an xunit test result.
 * Once we have the test runner done in Python, this can be discarded.
 * @param {string} fileId
 * @returns
 */
function createXmlName(fileId: string) {
    let name = path.join(path.dirname(fileId), path.basename(fileId, path.extname(fileId)));
    // Replace all path separators with ".".
    name = name.replace(/\\/g, '.').replace(/\//g, '.');
    // Remove leading "." and path separators.
    while (name.startsWith('.') || name.startsWith('/') || name.startsWith('\\')) {
        name = name.substring(1);
    }
    return name;
}
