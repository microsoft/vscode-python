import { CancellationToken, Disposable, OutputChannel, Uri } from 'vscode';
import { Product } from '../../common/installer';
import { BaseTestManager } from './baseTestManager';

export type TestFolder = TestResult & {
    name: string;
    testFiles: TestFile[];
    nameToRun: string;
    status?: TestStatus;
    folders: TestFolder[];
};

export type TestFile = TestResult & {
    name: string;
    fullPath: string;
    functions: TestFunction[];
    suites: TestSuite[];
    nameToRun: string;
    xmlName: string;
    status?: TestStatus;
    errorsWhenDiscovering?: string;
};

export type TestSuite = TestResult & {
    name: string;
    functions: TestFunction[];
    suites: TestSuite[];
    isUnitTest: Boolean;
    isInstance: Boolean;
    nameToRun: string;
    xmlName: string;
    status?: TestStatus;
};

export type TestFunction = TestResult & {
    name: string;
    nameToRun: string;
    status?: TestStatus;
};

export type TestResult = Node & {
    passed?: boolean;
    time: number;
    line?: number;
    message?: string;
    traceback?: string;
    functionsPassed?: number;
    functionsFailed?: number;
    functionsDidNotRun?: number;
};

export type Node = {
    expanded?: Boolean;
};

export type FlattenedTestFunction = {
    testFunction: TestFunction;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
};

export type FlattenedTestSuite = {
    testSuite: TestSuite;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
};

export type TestSummary = {
    passed: number;
    failures: number;
    errors: number;
    skipped: number;
};

export type Tests = {
    summary: TestSummary;
    testFiles: TestFile[];
    testFunctions: FlattenedTestFunction[];
    testSuites: FlattenedTestSuite[];
    testFolders: TestFolder[];
    rootTestFolders: TestFolder[];
};

export enum TestStatus {
    Unknown,
    Discovering,
    Idle,
    Running,
    Fail,
    Error,
    Skipped,
    Pass
}

export type TestsToRun = {
    testFolder?: TestFolder[];
    testFile?: TestFile[];
    testSuite?: TestSuite[];
    testFunction?: TestFunction[];
};

export type UnitTestProduct = Product.nosetest | Product.pytest | Product.unittest;

export interface ITestConfigSettingsService {
    updateTestArgs(testDirectory: string, product: UnitTestProduct, args: string[]): Promise<void>;
    enable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void>;
    disable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void>;
}

export interface ITestManagerService extends Disposable {
    getTestManager(): BaseTestManager | undefined;
    getTestWorkingDirectory(): string;
    getPreferredTestManager(): UnitTestProduct | undefined;
}

export interface ITestManagerServiceFactory {
    createTestManagerService(wkspace: Uri): ITestManagerService;
}

export interface IWorkspaceTestManagerService extends Disposable {
    getTestManager(resource: Uri): BaseTestManager | undefined;
    getTestWorkingDirectory(resource: Uri): string;
    getPreferredTestManager(resource: Uri): UnitTestProduct | undefined;
}

export interface ITestsHelper {
    flattenTestFiles(testFiles: TestFile[]): Tests;
    placeTestFilesIntoFolders(tests: Tests): void;
}

export interface ITestVisitor {
    visitTestFunction(testFunction: TestFunction): void;
    visitTestSuite(testSuite: TestSuite): void;
    visitTestFile(testFile: TestFile): void;
    visitTestFolder(testFile: TestFolder): void;
}

export interface ITestCollectionStorageService extends Disposable {
    getTests(wkspace: Uri): Tests | undefined;
    storeTests(wkspace: Uri, tests: Tests | null | undefined): void;
}

export interface ITestResultsService {
    resetResults(tests: Tests): void;
    updateResults(tests: Tests): void;
}

export interface ITestDebugLauncher {
    getPort(resource?: Uri): Promise<number>;
    launchDebugger(rootDirectory: string, testArgs: string[], port: number, token?: CancellationToken, outChannel?: OutputChannel): Promise<Tests>;
}
