import { injectable } from 'inversify';
import { Uri, workspace } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { Product } from '../../common/types';
import { ITestingSettings, TestSettingsPropertyNames } from '../configuration/types';
import { TestProvider } from '../types';
import {
    ITestsHelper,
    TestDataItem,
    TestDataItemType,
    TestFile,
    TestFolder,
    TestFunction,
    Tests,
    TestSuite,
    TestWorkspaceFolder,
    UnitTestProduct,
} from './types';

export async function selectTestWorkspace(appShell: IApplicationShell): Promise<Uri | undefined> {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return undefined;
    } else if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    } else {
        const workspaceFolder = await appShell.showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspaceFolder ? workspaceFolder.uri : undefined;
    }
}

export function extractBetweenDelimiters(content: string, startDelimiter: string, endDelimiter: string): string {
    content = content.substring(content.indexOf(startDelimiter) + startDelimiter.length);
    return content.substring(0, content.lastIndexOf(endDelimiter));
}

export function convertFileToPackage(filePath: string): string {
    const lastIndex = filePath.lastIndexOf('.');
    return filePath.substring(0, lastIndex).replace(/\//g, '.').replace(/\\/g, '.');
}

@injectable()
export class TestsHelper implements ITestsHelper {
    public parseProviderName(product: UnitTestProduct): TestProvider {
        switch (product) {
            case Product.pytest:
                return 'pytest';
            case Product.unittest:
                return 'unittest';
            default: {
                throw new Error(`Unknown Test Product ${product}`);
            }
        }
    }
    public parseProduct(provider: TestProvider): UnitTestProduct {
        switch (provider) {
            case 'pytest':
                return Product.pytest;
            case 'unittest':
                return Product.unittest;
            default: {
                throw new Error(`Unknown Test Provider ${provider}`);
            }
        }
    }
    public getSettingsPropertyNames(product: UnitTestProduct): TestSettingsPropertyNames {
        const id = this.parseProviderName(product);
        switch (id) {
            case 'pytest': {
                return {
                    argsName: 'pytestArgs' as keyof ITestingSettings,
                    pathName: 'pytestPath' as keyof ITestingSettings,
                    enabledName: 'pytestEnabled' as keyof ITestingSettings,
                };
            }
            case 'unittest': {
                return {
                    argsName: 'unittestArgs' as keyof ITestingSettings,
                    enabledName: 'unittestEnabled' as keyof ITestingSettings,
                };
            }
            default: {
                throw new Error(`Unknown Test Provider '${product}'`);
            }
        }
    }
}

export function getTestDataItemType(test: TestDataItem): TestDataItemType {
    if (test instanceof TestWorkspaceFolder) {
        return TestDataItemType.workspaceFolder;
    }
    if (getTestFile(test)) {
        return TestDataItemType.file;
    }
    if (getTestFolder(test)) {
        return TestDataItemType.folder;
    }
    if (getTestSuite(test)) {
        return TestDataItemType.suite;
    }
    if (getTestFunction(test)) {
        return TestDataItemType.function;
    }
    throw new Error('Unknown test type');
}
export function getTestFile(test: TestDataItem): TestFile | undefined {
    if (!test) {
        return;
    }
    // Only TestFile has a `fullPath` property.
    return typeof (test as TestFile).fullPath === 'string' ? (test as TestFile) : undefined;
}
export function getTestSuite(test: TestDataItem): TestSuite | undefined {
    if (!test) {
        return;
    }
    // Only TestSuite has a `suites` property.
    return Array.isArray((test as TestSuite).suites) && !getTestFile(test) ? (test as TestSuite) : undefined;
}
export function getTestFolder(test: TestDataItem): TestFolder | undefined {
    if (!test) {
        return;
    }
    // Only TestFolder has a `folders` property.
    return Array.isArray((test as TestFolder).folders) ? (test as TestFolder) : undefined;
}
export function getTestFunction(test: TestDataItem): TestFunction | undefined {
    if (!test) {
        return;
    }
    if (test instanceof TestWorkspaceFolder || getTestFile(test) || getTestFolder(test) || getTestSuite(test)) {
        return;
    }
    return test as TestFunction;
}

/**
 * Gets the parent for a given test item.
 * For test functions, this will return either a test suite or a test file.
 * For test suites, this will return either a test suite or a test file.
 * For test files, this will return a test folder.
 * For a test folder, this will return either a test folder or `undefined`.
 * @export
 * @param {Tests} tests
 * @param {TestDataItem} data
 * @returns {(TestDataItem | undefined)}
 */
export function getParent(tests: Tests, data: TestDataItem): TestDataItem | undefined {
    switch (getTestDataItemType(data)) {
        case TestDataItemType.file: {
            return getParentTestFolderForFile(tests, data as TestFile);
        }
        case TestDataItemType.folder: {
            return getParentTestFolder(tests, data as TestFolder);
        }
        case TestDataItemType.suite: {
            const suite = data as TestSuite;
            if (isSubtestsParent(suite)) {
                const fn = suite.functions[0];
                const parent = tests.testSuites.find((item) => item.testSuite.functions.indexOf(fn) >= 0);
                if (parent) {
                    return parent.testSuite;
                }
                return tests.testFiles.find((item) => item.functions.indexOf(fn) >= 0);
            }
            const parentSuite = tests.testSuites.find((item) => item.testSuite.suites.indexOf(suite) >= 0);
            if (parentSuite) {
                return parentSuite.testSuite;
            }
            return tests.testFiles.find((item) => item.suites.indexOf(suite) >= 0);
        }
        case TestDataItemType.function: {
            const fn = data as TestFunction;
            if (fn.subtestParent) {
                return fn.subtestParent.asSuite;
            }
            const parentSuite = tests.testSuites.find((item) => item.testSuite.functions.indexOf(fn) >= 0);
            if (parentSuite) {
                return parentSuite.testSuite;
            }
            return tests.testFiles.find((item) => item.functions.indexOf(fn) >= 0);
        }
        default: {
            throw new Error('Unknown test type');
        }
    }
}

/**
 * Returns the parent test folder give a given test file or folder.
 *
 * @export
 * @param {Tests} tests
 * @param {(TestFolder | TestFile)} item
 * @returns {(TestFolder | undefined)}
 */
function getParentTestFolder(tests: Tests, item: TestFolder | TestFile): TestFolder | undefined {
    if (getTestDataItemType(item) === TestDataItemType.folder) {
        return getParentTestFolderForFolder(tests, item as TestFolder);
    }
    return getParentTestFolderForFile(tests, item as TestFile);
}

/**
 * Gets the parent test file for a test item.
 *
 * @param {Tests} tests
 * @param {(TestSuite | TestFunction)} suite
 * @returns {TestFile}
 */
export function getParentFile(tests: Tests, suite: TestSuite | TestFunction): TestFile {
    let parent = getParent(tests, suite);
    while (parent) {
        if (getTestDataItemType(parent) === TestDataItemType.file) {
            return parent as TestFile;
        }
        parent = getParent(tests, parent);
    }
    throw new Error('No parent file for provided test item');
}
/**
 * Gets the parent test suite for a suite/function.
 *
 * @param {Tests} tests
 * @param {(TestSuite | TestFunction)} suite
 * @returns {(TestSuite | undefined)}
 */
export function getParentSuite(tests: Tests, suite: TestSuite | TestFunction): TestSuite | undefined {
    let parent = getParent(tests, suite);
    while (parent) {
        if (getTestDataItemType(parent) === TestDataItemType.suite) {
            return parent as TestSuite;
        }
        parent = getParent(tests, parent);
    }
    return;
}

/**
 * Returns the parent test folder give a given test file.
 *
 * @param {Tests} tests
 * @param {TestFile} file
 * @returns {(TestFolder | undefined)}
 */
function getParentTestFolderForFile(tests: Tests, file: TestFile): TestFolder | undefined {
    return tests.testFolders.find((folder) => folder.testFiles.some((item) => item === file));
}

/**
 * Returns the parent test folder for a given test folder.
 *
 * @param {Tests} tests
 * @param {TestFolder} folder
 * @returns {(TestFolder | undefined)}
 */
function getParentTestFolderForFolder(tests: Tests, folder: TestFolder): TestFolder | undefined {
    if (tests.rootTestFolders.indexOf(folder) >= 0) {
        return;
    }
    return tests.testFolders.find((item) => item.folders.some((child) => child === folder));
}

/**
 * Returns the children of a given test data item.
 *
 * @export
 * @param {Tests} tests
 * @param {TestDataItem} item
 * @returns {TestDataItem[]}
 */
export function getChildren(item: TestDataItem): TestDataItem[] {
    switch (getTestDataItemType(item)) {
        case TestDataItemType.folder: {
            return [...(item as TestFolder).folders, ...(item as TestFolder).testFiles];
        }
        case TestDataItemType.file: {
            const [subSuites, functions] = divideSubtests((item as TestFile).functions);
            return [...functions, ...(item as TestFile).suites, ...subSuites];
        }
        case TestDataItemType.suite: {
            let subSuites: TestSuite[] = [];
            let functions = (item as TestSuite).functions;
            if (!isSubtestsParent(item as TestSuite)) {
                [subSuites, functions] = divideSubtests((item as TestSuite).functions);
            }
            return [...functions, ...(item as TestSuite).suites, ...subSuites];
        }
        case TestDataItemType.function: {
            return [];
        }
        default: {
            throw new Error('Unknown Test Type');
        }
    }
}

function divideSubtests(mixed: TestFunction[]): [TestSuite[], TestFunction[]] {
    const suites: TestSuite[] = [];
    const functions: TestFunction[] = [];
    mixed.forEach((func) => {
        if (!func.subtestParent) {
            functions.push(func);
            return;
        }
        const parent = func.subtestParent.asSuite;
        if (suites.indexOf(parent) < 0) {
            suites.push(parent);
        }
    });
    return [suites, functions];
}

export function isSubtestsParent(suite: TestSuite): boolean {
    const functions = suite.functions;
    if (functions.length === 0) {
        return false;
    }
    const subtestParent = functions[0].subtestParent;
    if (subtestParent === undefined) {
        return false;
    }
    return subtestParent.asSuite === suite;
}

export function copyDesiredTestResults(source: Tests, target: Tests): void {
    copyResultsForFolders(source.testFolders, target.testFolders);
}

function copyResultsForFolders(source: TestFolder[], target: TestFolder[]): void {
    source.forEach((sourceFolder) => {
        const targetFolder = target.find(
            (folder) => folder.name === sourceFolder.name && folder.nameToRun === sourceFolder.nameToRun,
        );
        if (!targetFolder) {
            return;
        }
        copyValueTypes<TestFolder>(sourceFolder, targetFolder);
        copyResultsForFiles(sourceFolder.testFiles, targetFolder.testFiles);
        // These should be reinitialized
        targetFolder.functionsPassed = targetFolder.functionsDidNotRun = targetFolder.functionsFailed = 0;
    });
}
function copyResultsForFiles(source: TestFile[], target: TestFile[]): void {
    source.forEach((sourceFile) => {
        const targetFile = target.find((file) => file.name === sourceFile.name);
        if (!targetFile) {
            return;
        }
        copyValueTypes<TestFile>(sourceFile, targetFile);
        copyResultsForFunctions(sourceFile.functions, targetFile.functions);
        copyResultsForSuites(sourceFile.suites, targetFile.suites);
        // These should be reinitialized
        targetFile.functionsPassed = targetFile.functionsDidNotRun = targetFile.functionsFailed = 0;
    });
}

function copyResultsForFunctions(source: TestFunction[], target: TestFunction[]): void {
    source.forEach((sourceFn) => {
        const targetFn = target.find((fn) => fn.name === sourceFn.name && fn.nameToRun === sourceFn.nameToRun);
        if (!targetFn) {
            return;
        }
        copyValueTypes<TestFunction>(sourceFn, targetFn);
    });
}

function copyResultsForSuites(source: TestSuite[], target: TestSuite[]): void {
    source.forEach((sourceSuite) => {
        const targetSuite = target.find(
            (suite) =>
                suite.name === sourceSuite.name &&
                suite.nameToRun === sourceSuite.nameToRun &&
                suite.xmlName === sourceSuite.xmlName,
        );
        if (!targetSuite) {
            return;
        }
        copyValueTypes<TestSuite>(sourceSuite, targetSuite);
        copyResultsForFunctions(sourceSuite.functions, targetSuite.functions);
        copyResultsForSuites(sourceSuite.suites, targetSuite.suites);
        // These should be reinitialized
        targetSuite.functionsPassed = targetSuite.functionsDidNotRun = targetSuite.functionsFailed = 0;
    });
}

function copyValueTypes<T>(source: T, target: T): void {
    Object.keys(source).forEach((key) => {
        const value = (source as any)[key];
        if (['boolean', 'number', 'string', 'undefined'].indexOf(typeof value) >= 0) {
            (target as any)[key] = value;
        }
    });
}
