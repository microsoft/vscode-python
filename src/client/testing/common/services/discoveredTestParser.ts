// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { traceError } from '../../../common/logger';
import { TestDataItem } from '../../types';
import { getParentFile, getParentSuite, getTestType } from '../testUtils';
import { FlattenedTestFunction, FlattenedTestSuite, SubtestParent, TestFile, TestFolder, TestFunction, Tests, TestSuite, TestType } from '../types';
import { DiscoveredTests, ITestDiscoveredTestParser, TestContainer, TestItem } from './types';

@injectable()
export class TestDiscoveredTestParser implements ITestDiscoveredTestParser {
    constructor(@inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) { }
    public parse(resource: Uri, discoveredTests: DiscoveredTests[]): Tests {
        const tests: Tests = {
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

        // If the root is the workspace folder, then ignore that.
        for (const data of discoveredTests) {
            const rootFolder = {
                name: data.root, folders: [], time: 0,
                testFiles: [], resource: resource, nameToRun: data.rootid
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
    public buildChildren(rootFolder: TestFolder, parent: TestDataItem, discoveredTests: DiscoveredTests, tests: Tests) {
        const parentType = getTestType(parent);
        switch (parentType) {
            case TestType.testFolder: {
                this.processFolder(rootFolder, parent as TestFolder, discoveredTests, tests);
                break;
            }
            case TestType.testFile: {
                this.processFile(rootFolder, parent as TestFile, discoveredTests, tests);
                break;
            }
            case TestType.testSuite: {
                this.processSuite(rootFolder, parent as TestSuite, discoveredTests, tests);
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
    protected processFolder(rootFolder: TestFolder, parentFolder: TestFolder, discoveredTests: DiscoveredTests, tests: Tests) {
        const folders = discoveredTests.parents
            .filter(child => child.kind === 'folder' && child.parentid === parentFolder.nameToRun)
            .map(folder => createTestFolder(rootFolder, folder));

        const files = discoveredTests.parents
            .filter(child => child.kind === 'file' && child.parentid === parentFolder.nameToRun)
            .map(file => createTestFile(rootFolder, file));

        parentFolder.folders.push(...folders);
        parentFolder.testFiles.push(...files);
        tests.testFolders.push(...folders);
        tests.testFiles.push(...files);
        [...folders, ...files].forEach(item => this.buildChildren(rootFolder, item, discoveredTests, tests));
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
    protected processFile(rootFolder: TestFolder, parentFile: TestFile, discoveredTests: DiscoveredTests, tests: Tests) {
        const suites = discoveredTests.parents
            .filter(child => child.kind === 'suite' && child.parentid === parentFile.nameToRun)
            .map(suite => createTestSuite(parentFile, rootFolder.resource, suite));

        const functions = discoveredTests.tests
            .filter(func => func.parentid === parentFile.nameToRun)
            .map(func => createTestFunction(rootFolder, func));

        parentFile.suites.push(...suites);
        parentFile.functions.push(...functions);
        tests.testSuites.push(...suites.map(suite => createFlattenedSuite(tests, suite)));
        tests.testFunctions.push(...functions.map(func => createFlattenedFunction(tests, func)));
        suites.forEach(item => this.buildChildren(rootFolder, item, discoveredTests, tests));

        const parameterizedFunctions = discoveredTests.parents
            .filter(child => child.kind === 'function' && child.parentid === parentFile.nameToRun)
            .map(func => createParameterizedTestFunction(rootFolder, func));
        parameterizedFunctions.forEach(func => this.processParameterizedFunction(rootFolder, parentFile, func, discoveredTests, tests));
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
    protected processSuite(rootFolder: TestFolder, parentSuite: TestSuite, discoveredTests: DiscoveredTests, tests: Tests) {
        const suites = discoveredTests.parents
            .filter(child => child.kind === 'suite' && child.parentid === parentSuite.nameToRun)
            .map(suite => createTestSuite(parentSuite, rootFolder.resource, suite));

        const functions = discoveredTests.tests
            .filter(func => func.parentid === parentSuite.nameToRun)
            .map(func => createTestFunction(rootFolder, func));

        parentSuite.suites.push(...suites);
        parentSuite.functions.push(...functions);
        tests.testSuites.push(...suites.map(suite => createFlattenedSuite(tests, suite)));
        tests.testFunctions.push(...functions.map(func => createFlattenedFunction(tests, func)));
        suites.forEach(item => this.buildChildren(rootFolder, item, discoveredTests, tests));

        const parameterizedFunctions = discoveredTests.parents
            .filter(child => child.kind === 'function' && child.parentid === parentSuite.nameToRun)
            .map(func => createParameterizedTestFunction(rootFolder, func));
        parameterizedFunctions.forEach(func => this.processParameterizedFunction(rootFolder, parentSuite, func, discoveredTests, tests));
    }
    /**
     * Process the children of a parameterized function.
     * A parameterized function can only contain functions (in tests).
     * Hence limit processing just to those items.
     *
     * @protected
     * @param {TestFolder} rootFolder
     * @param {TestFunction} parentFunction
     * @param {DiscoveredTests} discoveredTests
     * @param {Tests} tests
     * @returns
     * @memberof TestDiscoveredTestParser
     */
    protected processParameterizedFunction(rootFolder: TestFolder, parent: TestFile | TestSuite, parentFunction: SubtestParent, discoveredTests: DiscoveredTests, tests: Tests) {
        if (!parentFunction.asSuite) {
            return;
        }
        const functions = discoveredTests.tests
            .filter(func => func.parentid === parentFunction.nameToRun)
            .map(func => createTestFunction(rootFolder, func));
        functions.map(func => func.subtestParent = parentFunction);
        parentFunction.asSuite.functions.push(...functions);
        parent.functions.push(...functions);
        tests.testFunctions.push(...functions.map(func => createFlattenedParameterizedFunction(tests, func, parent)));
    }
}

function createTestFolder(root: TestFolder, item: TestContainer): TestFolder {
    return {
        name: item.name, nameToRun: item.id, resource: root.resource, time: 0, folders: [], testFiles: []
    };
}
function createTestFile(root: TestFolder, item: TestContainer): TestFile {
    const fullyQualifiedName = path.isAbsolute(item.id) ? item.id : path.resolve(root.name, item.id);
    return {
        fullPath: fullyQualifiedName, functions: [], name: item.name,
        nameToRun: item.id, resource: root.resource, suites: [], time: 0, xmlName: createXmlName(item.id)
    };
}
function createTestSuite(parentSuiteFile: TestFile | TestSuite, resource: Uri, item: TestContainer): TestSuite {
    const suite = {
        functions: [], name: item.name, nameToRun: item.id, resource: resource,
        suites: [], time: 0, xmlName: '', isInstance: false, isUnitTest: false
    };
    suite.xmlName = `${parentSuiteFile.xmlName}.${item.name}`;
    return suite;
}
function createFlattenedSuite(tests: Tests, suite: TestSuite): FlattenedTestSuite {
    const parentFile = getParentFile(tests, suite);
    return {
        parentTestFile: parentFile, testSuite: suite, xmlClassName: parentFile.xmlName
    };
}
function createFlattenedParameterizedFunction(tests: Tests, func: TestFunction, parent: TestFile | TestSuite): FlattenedTestFunction {
    const type = getTestType(parent);
    const parentFile = (type && type === TestType.testSuite) ? getParentFile(tests, func) : parent as TestFile;
    const parentSuite = (type && type === TestType.testSuite) ? parent as TestSuite : undefined;
    return {
        parentTestFile: parentFile, parentTestSuite: parentSuite,
        xmlClassName: parentSuite ? parentSuite.xmlName : parentFile.xmlName, testFunction: func
    };
}
function createFlattenedFunction(tests: Tests, func: TestFunction): FlattenedTestFunction {
    const parent = getParentFile(tests, func);
    const type = parent ? getTestType(parent) : undefined;
    const parentFile = (type && type === TestType.testSuite) ? getParentFile(tests, func) : parent as TestFile;
    const parentSuite = getParentSuite(tests, func);
    return {
        parentTestFile: parentFile, parentTestSuite: parentSuite,
        xmlClassName: parentSuite ? parentSuite.xmlName : parentFile.xmlName, testFunction: func
    };
}
function createParameterizedTestFunction(root: TestFolder, item: TestContainer): SubtestParent {
    const suite: TestSuite = {
        functions: [], isInstance: false, isUnitTest: false,
        name: item.name, nameToRun: item.id, resource: root.resource,
        time: 0, suites: [], xmlName: ''
    };
    return {
        asSuite: suite, name: item.name, nameToRun: item.id, time: 0
    };
}
function createTestFunction(root: TestFolder, item: TestItem): TestFunction {
    return {
        name: item.name, nameToRun: item.id, resource: root.resource,
        time: 0, file: item.source.substr(0, item.source.lastIndexOf(':'))
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
    name = name.replace(/\\/g, '.').replace(/\//g, '.');
    // Remove leading . & / & \
    while (name.startsWith('.') || name.startsWith('/') || name.startsWith('\\')) {
        name = name.substring(1);
    }
    return name;
}
