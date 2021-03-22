import {
    CancellationToken,
    DebugConfiguration,
    DiagnosticCollection,
    DiagnosticSeverity,
    Disposable,
    Event,
    Location,
    OutputChannel,
    ProviderResult,
    TextDocument,
    TreeDataProvider,
    TreeItem,
    Uri,
    WorkspaceFolder,
} from 'vscode';
import { CommandSource } from '../../common/application/types';
import { Product } from '../../common/types';
import { DebuggerTypeName } from '../../debugger/constants';
import { ConsoleType } from '../../debugger/types';
import { TestProvider } from '../types';
import { TestSettingsPropertyNames } from '../configuration/types';

export type UnitTestProduct = Product.nosetest | Product.pytest | Product.unittest;

// ****************
// test args/options

export type TestDiscoveryOptions = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    token: CancellationToken;
    ignoreCache: boolean;
    outChannel: OutputChannel;
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
    token: CancellationToken;
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

export const ITestManagementService = Symbol('ITestManagementService');
export interface ITestManagementService {
    readonly onDidStatusChange: Event<WorkspaceTestStatus>;
    getTestManager(displayTestNotConfiguredMessage: boolean, resource?: Uri): Promise<ITestManager | undefined | void>;
    discoverTestsForDocument(doc: TextDocument): Promise<void>;
    autoDiscoverTests(resource: Uri | undefined): Promise<void>;
    discoverTests(
        cmdSource: CommandSource,
        resource?: Uri,
        ignoreCache?: boolean,
        userInitiated?: boolean,
        quietMode?: boolean,
    ): Promise<void>;
    stopTests(resource: Uri): Promise<void>;
    displayStopUI(message: string): Promise<void>;
    displayUI(cmdSource: CommandSource): Promise<void>;
    displayPickerUI(cmdSource: CommandSource, file: Uri, testFunctions: TestFunction[], debug?: boolean): Promise<void>;
    runTestsImpl(
        cmdSource: CommandSource,
        resource?: Uri,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug?: boolean,
    ): Promise<void>;
    runCurrentTestFile(cmdSource: CommandSource): Promise<void>;

    selectAndRunTestFile(cmdSource: CommandSource): Promise<void>;

    selectAndRunTestMethod(cmdSource: CommandSource, resource: Uri, debug?: boolean): Promise<void>;

    viewOutput(cmdSource: CommandSource): void;
}

export interface ITestManagerService extends Disposable {
    getTestManager(): ITestManager | undefined;
    getTestWorkingDirectory(): string;
    getPreferredTestManager(): UnitTestProduct | undefined;
}

export const IWorkspaceTestManagerService = Symbol('IWorkspaceTestManagerService');
export interface IWorkspaceTestManagerService extends Disposable {
    getTestManager(resource: Uri): ITestManager | undefined;
    getTestWorkingDirectory(resource: Uri): string;
    getPreferredTestManager(resource: Uri): UnitTestProduct | undefined;
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

export const ITestManagerRunner = Symbol('ITestManagerRunner');
export interface ITestManagerRunner {
    runTest(
        testResultsService: ITestResultsService,
        options: TestRunOptions,
        testManager: ITestManager,
    ): Promise<Tests>;
}

export const IUnitTestHelper = Symbol('IUnitTestHelper');
export interface IUnitTestHelper {
    getStartDirectory(args: string[]): string;
    getIdsOfTestsToRun(tests: Tests, testsToRun: TestsToRun): string[];
}

export const ITestsHelper = Symbol('ITestsHelper');
export interface ITestsHelper {
    parseProviderName(product: UnitTestProduct): TestProvider;
    parseProduct(provider: TestProvider): UnitTestProduct;
    getSettingsPropertyNames(product: Product): TestSettingsPropertyNames;
    flattenTestFiles(testFiles: TestFile[], workspaceFolder: string): Tests;
    placeTestFilesIntoFolders(tests: Tests, workspaceFolder: string): void;
    displayTestErrorMessage(message: string): void;
    shouldRunAllTests(testsToRun?: TestsToRun): boolean;
    mergeTests(items: Tests[]): Tests;
}

export const ITestVisitor = Symbol('ITestVisitor');
export interface ITestVisitor {
    visitTestFunction(testFunction: TestFunction): void;
    visitTestSuite(testSuite: TestSuite): void;
    visitTestFile(testFile: TestFile): void;
    visitTestFolder(testFile: TestFolder): void;
}

export const ITestCollectionStorageService = Symbol('ITestCollectionStorageService');
export interface ITestCollectionStorageService extends Disposable {
    onDidChange: Event<{ uri: Uri; data?: TestDataItem }>;
    getTests(wkspace: Uri): Tests | undefined;
    storeTests(wkspace: Uri, tests: Tests | null | undefined): void;
    findFlattendTestFunction(resource: Uri, func: TestFunction): FlattenedTestFunction | undefined;
    findFlattendTestSuite(resource: Uri, suite: TestSuite): FlattenedTestSuite | undefined;
    update(resource: Uri, item: TestDataItem): void;
}

export const ITestResultsService = Symbol('ITestResultsService');
export interface ITestResultsService {
    resetResults(tests: Tests): void;
    updateResults(tests: Tests): void;
}

export const ITestDebugLauncher = Symbol('ITestDebugLauncher');
export interface ITestDebugLauncher {
    launchDebugger(options: LaunchOptions): Promise<void>;
}

export const ITestManagerFactory = Symbol('ITestManagerFactory');
export interface ITestManagerFactory extends Function {
    (testProvider: TestProvider, workspaceFolder: Uri, rootDirectory: string): ITestManager;
}

export const ITestManagerServiceFactory = Symbol('TestManagerServiceFactory');
export interface ITestManagerServiceFactory extends Function {
    (workspaceFolder: Uri): ITestManagerService;
}

export const ITestManager = Symbol('ITestManager');
export interface ITestManager extends Disposable {
    readonly status: TestStatus;
    readonly enabled: boolean;
    readonly workingDirectory: string;
    readonly workspaceFolder: Uri;
    diagnosticCollection: DiagnosticCollection;
    readonly onDidStatusChange: Event<WorkspaceTestStatus>;
    stop(): void;
    resetTestResults(): void;
    discoverTests(
        cmdSource: CommandSource,
        ignoreCache?: boolean,
        quietMode?: boolean,
        userInitiated?: boolean,
        clearTestStatus?: boolean,
    ): Promise<Tests>;
    runTest(
        cmdSource: CommandSource,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug?: boolean,
    ): Promise<Tests>;
}

export const ITestDiscoveryService = Symbol('ITestDiscoveryService');
export interface ITestDiscoveryService {
    discoverTests(options: TestDiscoveryOptions): Promise<Tests>;
}

export const ITestsParser = Symbol('ITestsParser');
export interface ITestsParser {
    parse(content: string, options: ParserOptions): Tests;
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

export const IXUnitParser = Symbol('IXUnitParser');
export interface IXUnitParser {
    // Update "tests" with the results parsed from the given file.
    updateResultsFromXmlLogFile(tests: Tests, outputXmlFile: string): Promise<void>;
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

export const ITestContextService = Symbol('ITestContextService');
export interface ITestContextService extends Disposable {
    register(): void;
}

export const ITestsStatusUpdaterService = Symbol('ITestsStatusUpdaterService');
export interface ITestsStatusUpdaterService {
    updateStatusAsDiscovering(resource: Uri, tests?: Tests): void;
    updateStatusAsUnknown(resource: Uri, tests?: Tests): void;
    updateStatusAsRunning(resource: Uri, tests?: Tests): void;
    updateStatusAsRunningFailedTests(resource: Uri, tests?: Tests): void;
    updateStatusAsRunningSpecificTests(resource: Uri, testsToRun: TestsToRun, tests?: Tests): void;
    updateStatusOfRunningTestsAsIdle(resource: Uri, tests?: Tests): void;
    triggerUpdatesToTests(resource: Uri, tests?: Tests): void;
}

export const ITestDiagnosticService = Symbol('ITestDiagnosticService');
export interface ITestDiagnosticService {
    getMessagePrefix(status: TestStatus): string;
    getSeverity(unitTestSeverity: PythonTestMessageSeverity): DiagnosticSeverity;
}

export const IArgumentsService = Symbol('IArgumentsService');
export interface IArgumentsService {
    getKnownOptions(): { withArgs: string[]; withoutArgs: string[] };
    getOptionValue(args: string[], option: string): string | string[] | undefined;
    filterArguments(args: string[], argumentToRemove: string[]): string[];

    filterArguments(args: string[], filter: TestFilter): string[];
    getTestFolders(args: string[]): string[];
}

export const IArgumentsHelper = Symbol('IArgumentsHelper');
export interface IArgumentsHelper {
    getOptionValues(args: string[], option: string): string | string[] | undefined;
    filterArguments(args: string[], optionsWithArguments?: string[], optionsWithoutArguments?: string[]): string[];
    getPositionalArguments(
        args: string[],
        optionsWithArguments?: string[],
        optionsWithoutArguments?: string[],
    ): string[];
}

export const ITestResultDisplay = Symbol('ITestResultDisplay');
export interface ITestResultDisplay extends Disposable {
    enabled: boolean;
    readonly onDidChange: Event<void>;
    displayProgressStatus(testRunResult: Promise<Tests>, debug?: boolean): void;
    displayDiscoverStatus(testDiscovery: Promise<Tests>, quietMode?: boolean): Promise<Tests>;
}

export const ITestDisplay = Symbol('ITestDisplay');
export interface ITestDisplay {
    displayStopTestUI(workspace: Uri, message: string): void;
    displayTestUI(cmdSource: CommandSource, wkspace: Uri): void;
    selectTestFunction(rootDirectory: string, tests: Tests): Promise<FlattenedTestFunction>;
    selectTestFile(rootDirectory: string, tests: Tests): Promise<TestFile>;
    displayFunctionTestPickerUI(
        cmdSource: CommandSource,
        wkspace: Uri,
        rootDirectory: string,
        file: Uri,
        testFunctions: TestFunction[],
        debug?: boolean,
    ): void;
}

export const ITestTreeViewProvider = Symbol('ITestTreeViewProvider');
export interface ITestTreeViewProvider extends TreeDataProvider<TestDataItem> {
    onDidChangeTreeData: Event<TestDataItem | undefined>;
    getTreeItem(element: TestDataItem): Promise<TreeItem>;
    getChildren(element?: TestDataItem): ProviderResult<TestDataItem[]>;
    refresh(resource: Uri): void;
}

export const ITestDataItemResource = Symbol('ITestDataItemResource');
export interface ITestDataItemResource {
    getResource(testData: Readonly<TestDataItem>): Uri;
}
