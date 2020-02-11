import {
    CancellationToken,
    CancellationTokenSource,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticRelatedInformation,
    Disposable,
    Event,
    EventEmitter,
    languages,
    OutputChannel,
    Uri
} from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { isNotInstalledError } from '../../../common/helpers';
import { traceError } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IInstaller,
    IOutputChannel,
    IPythonSettings,
    Product
} from '../../../common/types';
import { getNamesAndValues } from '../../../common/utils/enum';
import { noop } from '../../../common/utils/misc';
import { IServiceContainer } from '../../../ioc/types';
import { EventName } from '../../../telemetry/constants';
import { sendTelemetryEvent } from '../../../telemetry/index';
import { TestDiscoverytTelemetry, TestRunTelemetry } from '../../../telemetry/types';
import { IPythonTestMessage, ITestDiagnosticService, WorkspaceTestStatus } from '../../types';
import { copyDesiredTestResults } from '../testUtils';
import { CANCELLATION_REASON, CommandSource, TEST_OUTPUT_CHANNEL } from './../constants';
import {
    ITestCollectionStorageService,
    ITestDiscoveryService,
    ITestManager,
    ITestResultsService,
    ITestsHelper,
    ITestsStatusUpdaterService,
    TestDiscoveryOptions,
    TestProvider,
    Tests,
    TestStatus,
    TestsToRun
} from './../types';

enum CancellationTokenType {
    testDiscovery,
    testRunner
}

// tslint:disable: member-ordering max-func-body-length

export abstract class BaseTestManager implements ITestManager {
    public diagnosticCollection: DiagnosticCollection;
    protected readonly settings: IPythonSettings;
    private readonly unitTestDiagnosticService: ITestDiagnosticService;
    public abstract get enabled(): boolean;
    protected get outputChannel() {
        return this._outputChannel;
    }
    protected get testResultsService() {
        return this._testResultsService;
    }
    private readonly testCollectionStorage: ITestCollectionStorageService;
    private readonly _testResultsService: ITestResultsService;
    private readonly commandManager: ICommandManager;
    private readonly workspaceService: IWorkspaceService;
    private readonly _outputChannel: OutputChannel;
    protected tests?: Tests;
    private _status: TestStatus = TestStatus.Unknown;
    private testDiscoveryCancellationTokenSource?: CancellationTokenSource;
    private testRunnerCancellationTokenSource?: CancellationTokenSource;
    private _installer!: IInstaller;
    private readonly testsStatusUpdaterService: ITestsStatusUpdaterService;
    private discoverTestsPromise?: Promise<Tests>;
    private readonly _onDidStatusChange = new EventEmitter<WorkspaceTestStatus>();
    private get installer(): IInstaller {
        if (!this._installer) {
            this._installer = this.serviceContainer.get<IInstaller>(IInstaller);
        }
        return this._installer;
    }
    constructor(
        public readonly testProvider: TestProvider,
        private readonly product: Product,
        public readonly workspaceFolder: Uri,
        protected rootDirectory: string,
        protected serviceContainer: IServiceContainer
    ) {
        this.updateStatus(TestStatus.Unknown);
        const configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.settings = configService.getSettings(this.rootDirectory ? Uri.file(this.rootDirectory) : undefined);
        const disposables = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this._outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(
            ITestCollectionStorageService
        );
        this._testResultsService = this.serviceContainer.get<ITestResultsService>(ITestResultsService);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.diagnosticCollection = languages.createDiagnosticCollection(this.testProvider);
        this.unitTestDiagnosticService = serviceContainer.get<ITestDiagnosticService>(ITestDiagnosticService);
        this.testsStatusUpdaterService = serviceContainer.get<ITestsStatusUpdaterService>(ITestsStatusUpdaterService);
        this.commandManager = serviceContainer.get<ICommandManager>(ICommandManager);
        disposables.push(this);
    }
    protected get testDiscoveryCancellationToken(): CancellationToken | undefined {
        return this.testDiscoveryCancellationTokenSource ? this.testDiscoveryCancellationTokenSource.token : undefined;
    }
    protected get testRunnerCancellationToken(): CancellationToken | undefined {
        return this.testRunnerCancellationTokenSource ? this.testRunnerCancellationTokenSource.token : undefined;
    }
    public dispose() {
        this.stop();
    }
    public get status(): TestStatus {
        return this._status;
    }
    public get onDidStatusChange(): Event<WorkspaceTestStatus> {
        return this._onDidStatusChange.event;
    }
    public get workingDirectory(): string {
        return this.settings.testing.cwd && this.settings.testing.cwd.length > 0
            ? this.settings.testing.cwd
            : this.rootDirectory;
    }
    public stop() {
        if (this.testDiscoveryCancellationTokenSource) {
            this.testDiscoveryCancellationTokenSource.cancel();
        }
        if (this.testRunnerCancellationTokenSource) {
            this.testRunnerCancellationTokenSource.cancel();
        }
    }
    public reset() {
        this.tests = undefined;
        this.updateStatus(TestStatus.Unknown);
    }
    public resetTestResults() {
        if (!this.tests) {
            return;
        }

        this.testResultsService.resetResults(this.tests!);
    }
    public async discoverTests(
        cmdSource: CommandSource,
        ignoreCache: boolean = false,
        quietMode: boolean = false,
        userInitiated: boolean = false,
        clearTestStatus: boolean = false
    ): Promise<Tests> {
        if (this.discoverTestsPromise) {
            return this.discoverTestsPromise;
        }
        this.discoverTestsPromise = this._discoverTests(
            cmdSource,
            ignoreCache,
            quietMode,
            userInitiated,
            clearTestStatus
        );
        this.discoverTestsPromise
            .catch(noop)
            .then(() => (this.discoverTestsPromise = undefined))
            .ignoreErrors();
        return this.discoverTestsPromise;
    }
    private async _discoverTests(
        cmdSource: CommandSource,
        ignoreCache: boolean = false,
        quietMode: boolean = false,
        userInitiated: boolean = false,
        clearTestStatus: boolean = false
    ): Promise<Tests> {
        if (!ignoreCache && this.tests! && this.tests!.testFunctions.length > 0) {
            this.updateStatus(TestStatus.Idle);
            return Promise.resolve(this.tests!);
        }
        if (userInitiated) {
            this.testsStatusUpdaterService.updateStatusAsDiscovering(this.workspaceFolder, this.tests);
        }
        this.updateStatus(TestStatus.Discovering);
        // If ignoreCache is true, its an indication of the fact that its a user invoked operation.
        // Hence we can stop the debugger.
        if (userInitiated) {
            this.stop();
        }
        const telementryProperties: TestDiscoverytTelemetry = {
            tool: this.testProvider,
            // tslint:disable-next-line:no-any prefer-type-cast
            trigger: cmdSource as any,
            failed: false
        };
        this.commandManager.executeCommand('setContext', 'testsDiscovered', true).then(noop, noop);
        this.createCancellationToken(CancellationTokenType.testDiscovery);
        const discoveryOptions = this.getDiscoveryOptions(ignoreCache);
        const discoveryService = this.serviceContainer.get<ITestDiscoveryService>(
            ITestDiscoveryService,
            this.testProvider
        );
        return discoveryService
            .discoverTests(discoveryOptions)
            .then(tests => {
                const wkspace = this.workspaceService.getWorkspaceFolder(Uri.file(this.rootDirectory))!.uri;
                const existingTests = this.testCollectionStorage.getTests(wkspace)!;
                if (clearTestStatus) {
                    this.resetTestResults();
                } else if (existingTests) {
                    copyDesiredTestResults(existingTests, tests);
                    this._testResultsService.updateResults(tests);
                }
                this.testCollectionStorage.storeTests(wkspace, tests);
                this.tests = tests;
                this.updateStatus(TestStatus.Idle);
                this.discoverTestsPromise = undefined;

                // have errors in Discovering
                let haveErrorsInDiscovering = false;
                tests.testFiles.forEach(file => {
                    if (file.errorsWhenDiscovering && file.errorsWhenDiscovering.length > 0) {
                        haveErrorsInDiscovering = true;
                        this.outputChannel.append('_'.repeat(10));
                        this.outputChannel.append(`There was an error in identifying unit tests in ${file.nameToRun}`);
                        this.outputChannel.appendLine('_'.repeat(10));
                        this.outputChannel.appendLine(file.errorsWhenDiscovering);
                    }
                });
                if (haveErrorsInDiscovering && !quietMode) {
                    const testsHelper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
                    testsHelper.displayTestErrorMessage('There were some errors in discovering unit tests');
                }
                this.disposeCancellationToken(CancellationTokenType.testDiscovery);
                sendTelemetryEvent(EventName.UNITTEST_DISCOVER, undefined, telementryProperties);
                return tests;
            })
            .catch(async (reason: {}) => {
                if (userInitiated) {
                    this.testsStatusUpdaterService.updateStatusAsUnknown(this.workspaceFolder, this.tests);
                }
                if (
                    isNotInstalledError(reason as Error) &&
                    !quietMode &&
                    !(await this.installer.isInstalled(this.product, this.workspaceFolder))
                ) {
                    this.installer
                        .promptToInstall(this.product, this.workspaceFolder)
                        .catch(ex => traceError('isNotInstalledError', ex));
                }

                this.tests = undefined;
                this.discoverTestsPromise = undefined;
                if (
                    this.testDiscoveryCancellationToken &&
                    this.testDiscoveryCancellationToken.isCancellationRequested
                ) {
                    reason = CANCELLATION_REASON;
                    this.updateStatus(TestStatus.Idle);
                } else {
                    telementryProperties.failed = true;
                    sendTelemetryEvent(EventName.UNITTEST_DISCOVER, undefined, telementryProperties);
                    this.updateStatus(TestStatus.Error);
                    this.outputChannel.appendLine('Test Discovery failed: ');
                    this.outputChannel.appendLine(reason.toString());
                }
                const wkspace = this.workspaceService.getWorkspaceFolder(Uri.file(this.rootDirectory))!.uri;
                this.testCollectionStorage.storeTests(wkspace, undefined);
                this.disposeCancellationToken(CancellationTokenType.testDiscovery);
                return Promise.reject(reason);
            });
    }
    public async runTest(
        cmdSource: CommandSource,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug?: boolean
    ): Promise<Tests> {
        const moreInfo = {
            Test_Provider: this.testProvider,
            Run_Failed_Tests: 'false',
            Run_Specific_File: 'false',
            Run_Specific_Class: 'false',
            Run_Specific_Function: 'false'
        };
        //Ensure valid values are sent.
        const validCmdSourceValues = getNamesAndValues<CommandSource>(CommandSource).map(item => item.value);
        const telementryProperties: TestRunTelemetry = {
            tool: this.testProvider,
            scope: 'all',
            debugging: debug === true,
            triggerSource: validCmdSourceValues.indexOf(cmdSource) === -1 ? 'commandpalette' : cmdSource,
            failed: false
        };

        if (!runFailedTests && !testsToRun) {
            this.testsStatusUpdaterService.updateStatusAsRunning(this.workspaceFolder, this.tests);
        }

        this.updateStatus(TestStatus.Running);
        if (this.testRunnerCancellationTokenSource) {
            this.testRunnerCancellationTokenSource.cancel();
        }

        if (runFailedTests === true) {
            moreInfo.Run_Failed_Tests = runFailedTests.toString();
            telementryProperties.scope = 'failed';
            this.testsStatusUpdaterService.updateStatusAsRunningFailedTests(this.workspaceFolder, this.tests);
        }
        if (testsToRun && typeof testsToRun === 'object') {
            if (Array.isArray(testsToRun.testFile) && testsToRun.testFile.length > 0) {
                telementryProperties.scope = 'file';
                moreInfo.Run_Specific_File = 'true';
            }
            if (Array.isArray(testsToRun.testSuite) && testsToRun.testSuite.length > 0) {
                telementryProperties.scope = 'class';
                moreInfo.Run_Specific_Class = 'true';
            }
            if (Array.isArray(testsToRun.testFunction) && testsToRun.testFunction.length > 0) {
                telementryProperties.scope = 'function';
                moreInfo.Run_Specific_Function = 'true';
            }
            this.testsStatusUpdaterService.updateStatusAsRunningSpecificTests(
                this.workspaceFolder,
                testsToRun,
                this.tests
            );
        }

        this.testsStatusUpdaterService.triggerUpdatesToTests(this.workspaceFolder, this.tests);
        // If running failed tests, then don't clear the previously build UnitTests
        // If we do so, then we end up re-discovering the unit tests and clearing previously cached list of failed tests
        // Similarly, if running a specific test or test file, don't clear the cache (possible tests have some state information retained)
        const clearDiscoveredTestCache =
            runFailedTests ||
            moreInfo.Run_Specific_File ||
            moreInfo.Run_Specific_Class ||
            moreInfo.Run_Specific_Function
                ? false
                : true;
        return this.discoverTests(cmdSource, clearDiscoveredTestCache, true, true)
            .catch(reason => {
                if (
                    this.testDiscoveryCancellationToken &&
                    this.testDiscoveryCancellationToken.isCancellationRequested
                ) {
                    return Promise.reject<Tests>(reason);
                }
                const testsHelper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
                testsHelper.displayTestErrorMessage('Errors in discovering tests, continuing with tests');
                return {
                    rootTestFolders: [],
                    testFiles: [],
                    testFolders: [],
                    testFunctions: [],
                    testSuites: [],
                    summary: { errors: 0, failures: 0, passed: 0, skipped: 0 }
                };
            })
            .then(tests => {
                this.updateStatus(TestStatus.Running);
                this.createCancellationToken(CancellationTokenType.testRunner);
                return this.runTestImpl(tests, testsToRun, runFailedTests, debug);
            })
            .then(() => {
                this.updateStatus(TestStatus.Idle);
                this.disposeCancellationToken(CancellationTokenType.testRunner);
                sendTelemetryEvent(EventName.UNITTEST_RUN, undefined, telementryProperties);
                this.testsStatusUpdaterService.updateStatusOfRunningTestsAsIdle(this.workspaceFolder, this.tests);
                this.testsStatusUpdaterService.triggerUpdatesToTests(this.workspaceFolder, this.tests);
                return this.tests!;
            })
            .catch(reason => {
                this.testsStatusUpdaterService.updateStatusOfRunningTestsAsIdle(this.workspaceFolder, this.tests);
                this.testsStatusUpdaterService.triggerUpdatesToTests(this.workspaceFolder, this.tests);
                if (this.testRunnerCancellationToken && this.testRunnerCancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this.updateStatus(TestStatus.Idle);
                } else {
                    this.updateStatus(TestStatus.Error);
                    telementryProperties.failed = true;
                    sendTelemetryEvent(EventName.UNITTEST_RUN, undefined, telementryProperties);
                }
                this.disposeCancellationToken(CancellationTokenType.testRunner);
                return Promise.reject<Tests>(reason);
            });
    }
    public async updateDiagnostics(tests: Tests, messages: IPythonTestMessage[]): Promise<void> {
        await this.stripStaleDiagnostics(tests, messages);

        // Update relevant file diagnostics for tests that have problems.
        const uniqueMsgFiles = messages.reduce<string[]>((filtered, msg) => {
            if (filtered.indexOf(msg.testFilePath) === -1 && msg.testFilePath !== undefined) {
                filtered.push(msg.testFilePath);
            }
            return filtered;
        }, []);
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        for (const msgFile of uniqueMsgFiles) {
            // Check all messages against each test file.
            const fileUri = Uri.file(msgFile);
            if (!this.diagnosticCollection.has(fileUri)) {
                // Create empty diagnostic for file URI so the rest of the logic can assume one already exists.
                const diagnostics: Diagnostic[] = [];
                this.diagnosticCollection.set(fileUri, diagnostics);
            }
            // Get the diagnostics for this file's URI before updating it so old tests that weren't run can still show problems.
            const oldDiagnostics = this.diagnosticCollection.get(fileUri)!;
            const newDiagnostics: Diagnostic[] = [];
            for (const diagnostic of oldDiagnostics) {
                newDiagnostics.push(diagnostic);
            }
            for (const msg of messages) {
                if (
                    fs.arePathsSame(fileUri.fsPath, Uri.file(msg.testFilePath).fsPath) &&
                    msg.status !== TestStatus.Pass
                ) {
                    const diagnostic = this.createDiagnostics(msg);
                    newDiagnostics.push(diagnostic);
                }
            }

            // Set the diagnostics for the file.
            this.diagnosticCollection.set(fileUri, newDiagnostics);
        }
    }
    protected abstract runTestImpl(
        tests: Tests,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug?: boolean
    ): Promise<Tests>;
    protected abstract getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions;
    private updateStatus(status: TestStatus): void {
        this._status = status;
        // Fire after 1ms, let existing code run to completion,
        // We need to allow for code to get into a consistent state.
        setTimeout(() => this._onDidStatusChange.fire({ workspace: this.workspaceFolder, status }), 1);
    }
    private createCancellationToken(tokenType: CancellationTokenType) {
        this.disposeCancellationToken(tokenType);
        if (tokenType === CancellationTokenType.testDiscovery) {
            this.testDiscoveryCancellationTokenSource = new CancellationTokenSource();
        } else {
            this.testRunnerCancellationTokenSource = new CancellationTokenSource();
        }
    }
    private disposeCancellationToken(tokenType: CancellationTokenType) {
        if (tokenType === CancellationTokenType.testDiscovery) {
            if (this.testDiscoveryCancellationTokenSource) {
                this.testDiscoveryCancellationTokenSource.dispose();
            }
            this.testDiscoveryCancellationTokenSource = undefined;
        } else {
            if (this.testRunnerCancellationTokenSource) {
                this.testRunnerCancellationTokenSource.dispose();
            }
            this.testRunnerCancellationTokenSource = undefined;
        }
    }
    /**
     * Whenever a test is run, any previous problems it had should be removed. This runs through
     * every already existing set of diagnostics for any that match the tests that were just run
     * so they can be stripped out (as they are now no longer relevant). If the tests pass, then
     * there is no need to have a diagnostic for it. If they fail, the stale diagnostic will be
     * replaced by an up-to-date diagnostic showing the most recent problem with that test.
     *
     * In order to identify diagnostics associated with the tests that were run, the `nameToRun`
     * property of each messages is compared to the `code` property of each diagnostic.
     *
     * @param messages Details about the tests that were just run.
     */
    private async stripStaleDiagnostics(tests: Tests, messages: IPythonTestMessage[]): Promise<void> {
        this.diagnosticCollection.forEach((diagnosticUri, oldDiagnostics, collection) => {
            const newDiagnostics: Diagnostic[] = [];
            for (const diagnostic of oldDiagnostics) {
                const matchingMsg = messages.find(msg => msg.code === diagnostic.code);
                if (matchingMsg === undefined) {
                    // No matching message was found, so this test was not included in the test run.
                    const matchingTest = tests.testFunctions.find(tf => tf.testFunction.nameToRun === diagnostic.code);
                    if (matchingTest !== undefined) {
                        // Matching test was found, so the diagnostic is still relevant.
                        newDiagnostics.push(diagnostic);
                    }
                }
            }
            // Set the diagnostics for the file.
            collection.set(diagnosticUri, newDiagnostics);
        });
    }

    private createDiagnostics(message: IPythonTestMessage): Diagnostic {
        const stackStart = message.locationStack![0];
        const diagPrefix = this.unitTestDiagnosticService.getMessagePrefix(message.status!);
        const severity = this.unitTestDiagnosticService.getSeverity(message.severity)!;
        const diagMsg = message.message ? message.message.split('\n')[0] : '';
        const diagnostic = new Diagnostic(
            stackStart.location.range,
            `${diagPrefix ? `${diagPrefix}: ` : ''}${diagMsg}`,
            severity
        );
        diagnostic.code = message.code;
        diagnostic.source = message.provider;
        const relatedInfoArr: DiagnosticRelatedInformation[] = [];
        for (const frameDetails of message.locationStack!) {
            const relatedInfo = new DiagnosticRelatedInformation(frameDetails.location, frameDetails.lineText);
            relatedInfoArr.push(relatedInfo);
        }
        diagnostic.relatedInformation = relatedInfoArr;
        return diagnostic;
    }
}
