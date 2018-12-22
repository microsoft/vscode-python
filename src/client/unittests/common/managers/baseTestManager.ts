import { CancellationToken, CancellationTokenSource, Disposable, OutputChannel, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { isNotInstalledError } from '../../../common/helpers';
import { IConfigurationService, IDisposableRegistry, IInstaller, IOutputChannel, IPythonSettings, Product } from '../../../common/types';
import { getNamesAndValues } from '../../../common/utils/enum';
import { IServiceContainer } from '../../../ioc/types';
import { UNITTEST_DISCOVER, UNITTEST_RUN } from '../../../telemetry/constants';
import { sendTelemetryEvent } from '../../../telemetry/index';
import { TestDiscoverytTelemetry, TestRunTelemetry } from '../../../telemetry/types';
import { CANCELLATION_REASON, CommandSource, TEST_OUTPUT_CHANNEL } from './../constants';
import { ITestCollectionStorageService, ITestDiscoveryService, ITestManager, ITestResultsService, ITestsHelper, TestDiscoveryOptions, TestProvider, Tests, TestStatus, TestsToRun } from './../types';

enum CancellationTokenType {
    testDiscovery,
    testRunner
}

export abstract class BaseTestManager implements ITestManager {
    protected readonly settings: IPythonSettings;
    public abstract get enabled(): boolean;
    protected get outputChannel() {
        return this._outputChannel;
    }
    protected get testResultsService() {
        return this._testResultsService;
    }
    private testCollectionStorage: ITestCollectionStorageService;
    private _testResultsService: ITestResultsService;
    private workspaceService: IWorkspaceService;
    private _outputChannel: OutputChannel;
    private tests?: Tests;
    private _status: TestStatus = TestStatus.Unknown;
    private testDiscoveryCancellationTokenSource?: CancellationTokenSource;
    private testRunnerCancellationTokenSource?: CancellationTokenSource;
    private _installer!: IInstaller;
    private discoverTestsPromise?: Promise<Tests>;
    private get installer(): IInstaller {
        if (!this._installer) {
            this._installer = this.serviceContainer.get<IInstaller>(IInstaller);
        }
        return this._installer;
    }
    constructor(public readonly testProvider: TestProvider, private product: Product, public readonly workspaceFolder: Uri, protected rootDirectory: string,
        protected serviceContainer: IServiceContainer) {
        this._status = TestStatus.Unknown;
        const configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.settings = configService.getSettings(this.rootDirectory ? Uri.file(this.rootDirectory) : undefined);
        const disposables = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this._outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService);
        this._testResultsService = this.serviceContainer.get<ITestResultsService>(ITestResultsService);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
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
    public get workingDirectory(): string {
        return this.settings.unitTest.cwd && this.settings.unitTest.cwd.length > 0 ? this.settings.unitTest.cwd : this.rootDirectory;
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
        this._status = TestStatus.Unknown;
        this.tests = undefined;
    }
    public resetTestResults() {
        if (!this.tests) {
            return;
        }

        this.testResultsService.resetResults(this.tests!);
    }
    public async discoverTests(cmdSource: CommandSource, ignoreCache: boolean = false, quietMode: boolean = false, userInitiated: boolean = false): Promise<Tests> {
        if (this.discoverTestsPromise) {
            return this.discoverTestsPromise!;
        }

        if (!ignoreCache && this.tests! && this.tests!.testFunctions.length > 0) {
            this._status = TestStatus.Idle;
            return Promise.resolve(this.tests!);
        }
        this._status = TestStatus.Discovering;

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

        this.createCancellationToken(CancellationTokenType.testDiscovery);
        const discoveryOptions = this.getDiscoveryOptions(ignoreCache);
        const discoveryService = this.serviceContainer.get<ITestDiscoveryService>(ITestDiscoveryService, this.testProvider);
        return discoveryService.discoverTests(discoveryOptions)
            .then(tests => {
                this.tests = tests;
                this._status = TestStatus.Idle;
                this.resetTestResults();
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
                const wkspace = this.workspaceService.getWorkspaceFolder(Uri.file(this.rootDirectory))!.uri;
                this.testCollectionStorage.storeTests(wkspace, tests);
                this.disposeCancellationToken(CancellationTokenType.testDiscovery);
                sendTelemetryEvent(UNITTEST_DISCOVER, undefined, telementryProperties);
                return tests;
            }).catch((reason: {}) => {
                if (isNotInstalledError(reason as Error) && !quietMode) {
                    this.installer.promptToInstall(this.product, this.workspaceFolder)
                        .catch(ex => console.error('Python Extension: isNotInstalledError', ex));
                }

                this.tests = undefined;
                this.discoverTestsPromise = undefined;
                if (this.testDiscoveryCancellationToken && this.testDiscoveryCancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this._status = TestStatus.Idle;
                } else {
                    telementryProperties.failed = true;
                    sendTelemetryEvent(UNITTEST_DISCOVER, undefined, telementryProperties);
                    this._status = TestStatus.Error;
                    this.outputChannel.appendLine('Test Discovery failed: ');
                    // tslint:disable-next-line:prefer-template
                    this.outputChannel.appendLine(reason.toString());
                }
                const wkspace = this.workspaceService.getWorkspaceFolder(Uri.file(this.rootDirectory))!.uri;
                this.testCollectionStorage.storeTests(wkspace, null);
                this.disposeCancellationToken(CancellationTokenType.testDiscovery);
                return Promise.reject(reason);
            });
    }
    public runTest(cmdSource: CommandSource, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<Tests> {
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
        if (runFailedTests === true) {
            // tslint:disable-next-line:prefer-template
            moreInfo.Run_Failed_Tests = runFailedTests.toString();
            telementryProperties.scope = 'failed';
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
        }

        if (runFailedTests === false && testsToRun === null) {
            this.resetTestResults();
        }

        this._status = TestStatus.Running;
        if (this.testRunnerCancellationTokenSource) {
            this.testRunnerCancellationTokenSource.cancel();
        }
        // If running failed tests, then don't clear the previously build UnitTests
        // If we do so, then we end up re-discovering the unit tests and clearing previously cached list of failed tests
        // Similarly, if running a specific test or test file, don't clear the cache (possible tests have some state information retained)
        const clearDiscoveredTestCache = runFailedTests || moreInfo.Run_Specific_File || moreInfo.Run_Specific_Class || moreInfo.Run_Specific_Function ? false : true;
        return this.discoverTests(cmdSource, clearDiscoveredTestCache, true, true)
            .catch(reason => {
                if (this.testDiscoveryCancellationToken && this.testDiscoveryCancellationToken.isCancellationRequested) {
                    return Promise.reject<Tests>(reason);
                }
                const testsHelper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
                testsHelper.displayTestErrorMessage('Errors in discovering tests, continuing with tests');
                return {
                    rootTestFolders: [], testFiles: [], testFolders: [], testFunctions: [], testSuites: [],
                    summary: { errors: 0, failures: 0, passed: 0, skipped: 0 }
                };
            })
            .then(tests => {
                this.createCancellationToken(CancellationTokenType.testRunner);
                return this.runTestImpl(tests, testsToRun, runFailedTests, debug);
            }).then(() => {
                this._status = TestStatus.Idle;
                this.disposeCancellationToken(CancellationTokenType.testRunner);
                sendTelemetryEvent(UNITTEST_RUN, undefined, telementryProperties);
                return this.tests!;
            }).catch(reason => {
                if (this.testRunnerCancellationToken && this.testRunnerCancellationToken.isCancellationRequested) {
                    reason = CANCELLATION_REASON;
                    this._status = TestStatus.Idle;
                } else {
                    this._status = TestStatus.Error;
                    telementryProperties.failed = true;
                    sendTelemetryEvent(UNITTEST_RUN, undefined, telementryProperties);
                }
                this.disposeCancellationToken(CancellationTokenType.testRunner);
                return Promise.reject<Tests>(reason);
            });
    }
    // tslint:disable-next-line:no-any
    protected abstract runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any>;
    protected abstract getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions;
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
}
