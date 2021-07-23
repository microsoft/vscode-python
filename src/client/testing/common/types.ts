import {
    CancellationToken,
    DebugConfiguration,
    DiagnosticSeverity,
    Disposable,
    Location,
    OutputChannel,
    Uri,
    WorkspaceFolder,
} from 'vscode';
import { Product } from '../../common/types';
import { DebuggerTypeName } from '../../debugger/constants';
import { ConsoleType } from '../../debugger/types';
import { TestSettingsPropertyNames } from '../configuration/types';
import { TestProvider } from '../types';

export type UnitTestProduct = Product.pytest | Product.unittest;

// ****************
// test args/options

export type TestDiscoveryOptions = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    token?: CancellationToken;
    ignoreCache: boolean;
    outChannel?: OutputChannel;
};

export type TestRunOptions = {
    workspaceFolder: Uri;
    cwd: string;
    tests: Tests;
    args: string[];
    testsToRun?: TestsToRun;
    token: CancellationToken;
    outChannel?: OutputChannel;
    debug?: boolean;
};

export type UnitTestParserOptions = TestDiscoveryOptions & { startDirectory: string };

export type LaunchOptions = {
    cwd: string;
    args: string[];
    testProvider: TestProvider;
    token?: CancellationToken;
    outChannel?: OutputChannel;
};

export type ParserOptions = TestDiscoveryOptions;

export type Options = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    outChannel?: OutputChannel;
    token?: CancellationToken;
};

export type TestsToRun = {
    testFolder?: TestFolder[];
    testFile?: TestFile[];
    testSuite?: TestSuite[];
    testFunction?: TestFunction[];
};

export enum TestFilter {
    removeTests = 'removeTests',
    discovery = 'discovery',
    runAll = 'runAll',
    runSpecific = 'runSpecific',
    debugAll = 'debugAll',
    debugSpecific = 'debugSpecific',
}

// ****************
// test results

export enum TestingType {
    folder = 'folder',
    file = 'file',
    suite = 'suite',
    function = 'function',
}

// A better approach would be bottom-up using composition.  However,
// it's a bit trickier to get right, so we take the simpler approach
// for now.
export enum TestStatus {
    Unknown = 'Unknown',
    Discovering = 'Discovering',
    Idle = 'Idle',
    Running = 'Running',
    Fail = 'Fail',
    Error = 'Error',
    Skipped = 'Skipped',
    Pass = 'Pass',
}
export type FinalTestStatus = TestStatus.Fail | TestStatus.Error | TestStatus.Skipped | TestStatus.Pass;
export type NonPassingTestStatus = Exclude<FinalTestStatus, TestStatus.Pass>;

const nonPassing = Object.values(TestStatus).filter((value) => value !== TestStatus.Pass);
export function isNonPassingTestStatus(status: TestStatus): boolean {
    return nonPassing.includes(status);
}

export type TestResult = {
    status?: TestStatus;
    passed?: boolean;
    time: number;
    line?: number;
    file?: string;
    message?: string;
    traceback?: string;
    functionsPassed?: number;
    functionsFailed?: number;
    functionsDidNotRun?: number;
};

type TestingNode = TestResult & {
    name: string;
    nameToRun: string;
    resource: Uri;
};

export type TestFolder = TestingNode & {
    folders: TestFolder[];
    testFiles: TestFile[];
};

type TestingXMLNode = TestingNode & {
    xmlName: string;
};

export type TestFile = TestingXMLNode & {
    fullPath: string;
    functions: TestFunction[];
    suites: TestSuite[];
    errorsWhenDiscovering?: string;
};

export type TestSuite = TestingXMLNode & {
    functions: TestFunction[];
    suites: TestSuite[];
    isUnitTest: boolean;
    isInstance: boolean;
};

export type TestFunction = TestingNode & {
    subtestParent?: SubtestParent;
};

export type SubtestParent = TestResult & {
    name: string;
    nameToRun: string;
    asSuite: TestSuite;
};

export type FlattenedTestFunction = {
    testFunction: TestFunction;
    parentTestSuite?: TestSuite;
    parentTestFile: TestFile;
    xmlClassName: string;
};

export type FlattenedTestSuite = {
    testSuite: TestSuite;
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

// ****************
// test results messages

export enum PythonTestMessageSeverity {
    Error,
    Failure,
    Skip,
    Pass,
}
export type NonPassingTestSeverity = Exclude<PythonTestMessageSeverity, PythonTestMessageSeverity.Pass>;

export enum DiagnosticMessageType {
    Error,
    Fail,
    Skipped,
    Pass,
}
export type NonPassingTestMessageType = Exclude<DiagnosticMessageType, DiagnosticMessageType.Pass>;

interface IPythonTestMessageCommon {
    code: string;
    testFilePath: string;
    status: FinalTestStatus;
    severity: PythonTestMessageSeverity;
    testTime: number;
    provider: string;
}
export interface ITestPassingMessage extends IPythonTestMessageCommon {
    status: TestStatus.Pass;
    severity: PythonTestMessageSeverity.Pass;
}
export interface ITestNonPassingMessage extends IPythonTestMessageCommon {
    status: NonPassingTestStatus;
    severity: NonPassingTestSeverity;
    // The following are failure-specific.
    message?: string;
    traceback?: string;
    locationStack: ILocationStackFrameDetails[];
}
export type IPythonTestMessage = ITestPassingMessage | ITestNonPassingMessage;

export interface ILocationStackFrameDetails {
    location: Location;
    lineText: string;
}

// ****************
// test events

export type WorkspaceTestStatus = { workspace: Uri; status: TestStatus };

// ****************
// tree view data

export enum TestDataItemType {
    workspaceFolder = 'workspaceFolder',
    folder = 'folder',
    file = 'file',
    suite = 'suite',
    function = 'function',
}

export type TestDataItem = TestWorkspaceFolder | TestFolder | TestFile | TestSuite | TestFunction;

export class TestWorkspaceFolder {
    public status?: TestStatus;

    public time?: number;

    public functionsPassed?: number;

    public functionsFailed?: number;

    public functionsDidNotRun?: number;

    public passed?: boolean;

    constructor(public readonly workspaceFolder: WorkspaceFolder) {}

    public get resource(): Uri {
        return this.workspaceFolder.uri;
    }

    public get name(): string {
        return this.workspaceFolder.name;
    }
}

// ****************
// interfaces

export const ITestsHelper = Symbol('ITestsHelper');
export interface ITestsHelper {
    parseProviderName(product: UnitTestProduct): TestProvider;
    parseProduct(provider: TestProvider): UnitTestProduct;
    getSettingsPropertyNames(product: Product): TestSettingsPropertyNames;
}

export const ITestConfigurationService = Symbol('ITestConfigurationService');
export interface ITestConfigurationService {
    displayTestFrameworkError(wkspace: Uri): Promise<void>;
    selectTestRunner(placeHolderMessage: string): Promise<UnitTestProduct | undefined>;
    enableTest(wkspace: Uri, product: UnitTestProduct): Promise<void>;
    promptToEnableAndConfigureTestFramework(wkspace: Uri): Promise<void>;
}

export const ITestConfigSettingsService = Symbol('ITestConfigSettingsService');
export interface ITestConfigSettingsService {
    updateTestArgs(testDirectory: string | Uri, product: UnitTestProduct, args: string[]): Promise<void>;
    enable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void>;
    disable(testDirectory: string | Uri, product: UnitTestProduct): Promise<void>;
    getTestEnablingSetting(product: UnitTestProduct): string;
}

export interface ITestConfigurationManager {
    requiresUserToConfigure(wkspace: Uri): Promise<boolean>;
    configure(wkspace: Uri): Promise<void>;
    enable(): Promise<void>;
    disable(): Promise<void>;
}

export const ITestConfigurationManagerFactory = Symbol('ITestConfigurationManagerFactory');
export interface ITestConfigurationManagerFactory {
    create(wkspace: Uri, product: Product, cfg?: ITestConfigSettingsService): ITestConfigurationManager;
}
export const ITestDebugLauncher = Symbol('ITestDebugLauncher');
export interface ITestDebugLauncher {
    launchDebugger(options: LaunchOptions): Promise<void>;
}

export const ITestDiscoveryService = Symbol('ITestDiscoveryService');
export interface ITestDiscoveryService {
    discoverTests(options: TestDiscoveryOptions): Promise<Tests>;
}

export const IUnitTestSocketServer = Symbol('IUnitTestSocketServer');
export interface IUnitTestSocketServer extends Disposable {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    start(options?: { port?: number; host?: string }): Promise<number>;
    stop(): void;
}

export const ITestRunner = Symbol('ITestRunner');
export interface ITestRunner {
    run(testProvider: TestProvider, options: Options): Promise<string>;
}

export const ITestMessageService = Symbol('ITestMessageService');
export interface ITestMessageService {
    getFilteredTestMessages(rootDirectory: string, testResults: Tests): Promise<IPythonTestMessage[]>;
}

export interface ITestDebugConfig extends DebugConfiguration {
    type: typeof DebuggerTypeName;
    request: 'test';

    pythonPath?: string;
    console?: ConsoleType;
    cwd?: string;
    env?: Record<string, string | undefined>;
    envFile?: string;

    // converted to DebugOptions:
    stopOnEntry?: boolean;
    showReturnValue?: boolean;
    redirectOutput?: boolean; // default: true
    debugStdLib?: boolean;
    justMyCode?: boolean;
    subProcess?: boolean;
}

export const ITestDiagnosticService = Symbol('ITestDiagnosticService');
export interface ITestDiagnosticService {
    getMessagePrefix(status: TestStatus): string;
    getSeverity(unitTestSeverity: PythonTestMessageSeverity): DiagnosticSeverity;
}
