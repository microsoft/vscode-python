'use strict';

import { inject, injectable } from 'inversify';
import {
    ConfigurationChangeEvent,
    Disposable,
    DocumentSymbolProvider,
    Event,
    EventEmitter,
    OutputChannel,
    TextDocument,
    Uri,
} from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import * as constants from '../common/constants';
import '../common/extensions';
import { traceError } from '../common/logger';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, Product, Resource } from '../common/types';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { EventName } from '../telemetry/constants';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry/index';
import { activateCodeLenses } from './codeLenses/main';
import { CANCELLATION_REASON } from './common/constants';
import { selectTestWorkspace } from './common/testUtils';
import { TestSettingsPropertyNames } from './configuration/types';
import {
    ITestCollectionStorageService,
    ITestConfigurationService,
    ITestManagementService,
    ITestManager,
    IWorkspaceTestManagerService,
    ITestDisplay,
    TestFile,
    TestFunction,
    ITestContextService,
    ITestResultDisplay,
    ITestsHelper,
    TestStatus,
    TestsToRun,
    TestWorkspaceFolder,
    WorkspaceTestStatus,
} from './common/types';
import { TEST_OUTPUT_CHANNEL } from './constants';
import { ITestingService } from './types';

@injectable()
export class TestingService implements ITestingService {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}

    public async activate(symbolProvider: DocumentSymbolProvider): Promise<void> {
        const mgmt = this.serviceContainer.get<ITestManagementService>(ITestManagementService);
        return ((mgmt as unknown) as ITestingService).activate(symbolProvider);
    }

    public register(): void {
        const context = this.serviceContainer.get<ITestContextService>(ITestContextService);
        context.register();
    }

    public getSettingsPropertyNames(product: Product): TestSettingsPropertyNames {
        const helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        return helper.getSettingsPropertyNames(product);
    }
}

@injectable()
export class UnitTestManagementService implements ITestManagementService, Disposable {
    private readonly outputChannel: OutputChannel;
    private activatedOnce: boolean = false;
    private readonly disposableRegistry: Disposable[];
    private workspaceTestManagerService?: IWorkspaceTestManagerService;
    private documentManager: IDocumentManager;
    private workspaceService: IWorkspaceService;
    private testResultDisplay?: ITestResultDisplay;
    private autoDiscoverTimer?: NodeJS.Timer | number;
    private configChangedTimer?: NodeJS.Timer | number;
    private testManagers = new Set<ITestManager>();
    private readonly _onDidStatusChange: EventEmitter<WorkspaceTestStatus> = new EventEmitter<WorkspaceTestStatus>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager);

        this.disposableRegistry.push(this);
    }
    public dispose() {
        if (this.workspaceTestManagerService) {
            this.workspaceTestManagerService.dispose();
        }
        if (this.configChangedTimer) {
            clearTimeout(this.configChangedTimer as any);
            this.configChangedTimer = undefined;
        }
        if (this.autoDiscoverTimer) {
            clearTimeout(this.autoDiscoverTimer as any);
            this.autoDiscoverTimer = undefined;
        }
    }
    public get onDidStatusChange(): Event<WorkspaceTestStatus> {
        return this._onDidStatusChange.event;
    }
    public async activate(symbolProvider: DocumentSymbolProvider): Promise<void> {
        if (this.activatedOnce) {
            return;
        }
        this.activatedOnce = true;
        this.workspaceTestManagerService = this.serviceContainer.get<IWorkspaceTestManagerService>(
            IWorkspaceTestManagerService,
        );

        this.registerHandlers();
        this.registerCommands();
        this.autoDiscoverTests(undefined).catch((ex) =>
            traceError('Failed to auto discover tests upon activation', ex),
        );
        await this.registerSymbolProvider(symbolProvider);
    }
    public async getTestManager(
        displayTestNotConfiguredMessage: boolean,
        resource?: Uri,
    ): Promise<ITestManager | undefined | void> {
        let wkspace: Uri | undefined;
        if (resource) {
            const wkspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
            wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
        } else {
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            wkspace = await selectTestWorkspace(appShell);
        }
        if (!wkspace) {
            return;
        }
        const testManager = this.workspaceTestManagerService!.getTestManager(wkspace);
        if (testManager) {
            if (!this.testManagers.has(testManager)) {
                this.testManagers.add(testManager);
                const handler = testManager.onDidStatusChange((e) => this._onDidStatusChange.fire(e));
                this.disposableRegistry.push(handler);
            }
            return testManager;
        }
        if (displayTestNotConfiguredMessage) {
            const configurationService = this.serviceContainer.get<ITestConfigurationService>(
                ITestConfigurationService,
            );
            await configurationService.displayTestFrameworkError(wkspace);
        }
    }
    public async configurationChangeHandler(eventArgs: ConfigurationChangeEvent) {
        // If there's one workspace, then stop the tests and restart,
        // else let the user do this manually.
        if (!this.workspaceService.hasWorkspaceFolders || this.workspaceService.workspaceFolders!.length > 1) {
            return;
        }
        if (!Array.isArray(this.workspaceService.workspaceFolders)) {
            return;
        }
        const workspaceFolderUri = this.workspaceService.workspaceFolders.find((w) =>
            eventArgs.affectsConfiguration('python.testing', w.uri),
        );
        if (!workspaceFolderUri) {
            return;
        }
        const workspaceUri = workspaceFolderUri.uri;
        const settings = this.serviceContainer
            .get<IConfigurationService>(IConfigurationService)
            .getSettings(workspaceUri);
        if (
            !settings.testing.nosetestsEnabled &&
            !settings.testing.pytestEnabled &&
            !settings.testing.unittestEnabled
        ) {
            if (this.testResultDisplay) {
                this.testResultDisplay.enabled = false;
            }

            // TODO: Why are we disposing, what happens when tests are enabled.
            if (this.workspaceTestManagerService) {
                this.workspaceTestManagerService.dispose();
            }
            return;
        }
        if (this.testResultDisplay) {
            this.testResultDisplay.enabled = true;
        }
        this.autoDiscoverTests(workspaceUri).catch((ex) =>
            traceError('Failed to auto discover tests upon activation', ex),
        );
    }

    public async discoverTestsForDocument(doc: TextDocument): Promise<void> {
        const testManager = await this.getTestManager(false, doc.uri);
        if (!testManager) {
            return;
        }
        const tests = await testManager.discoverTests(constants.CommandSource.auto, false, true);
        if (!tests || !Array.isArray(tests.testFiles) || tests.testFiles.length === 0) {
            return;
        }
        if (tests.testFiles.findIndex((f: TestFile) => f.fullPath === doc.uri.fsPath) === -1) {
            return;
        }

        if (this.autoDiscoverTimer) {
            clearTimeout(this.autoDiscoverTimer as any);
        }
        this.autoDiscoverTimer = setTimeout(
            () => this.discoverTests(constants.CommandSource.auto, doc.uri, true, false, true),
            1000,
        );
    }
    public async autoDiscoverTests(resource: Resource) {
        if (!this.workspaceService.hasWorkspaceFolders) {
            return;
        }
        // Default to discovering tests in first folder if none specified.
        if (!resource) {
            resource = this.workspaceService.workspaceFolders![0].uri;
        }
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configurationService.getSettings(resource);
        if (
            !settings.testing.nosetestsEnabled &&
            !settings.testing.pytestEnabled &&
            !settings.testing.unittestEnabled
        ) {
            return;
        }

        this.discoverTests(constants.CommandSource.auto, resource, true).ignoreErrors();
    }
    public async discoverTests(
        cmdSource: constants.CommandSource,
        resource?: Uri,
        ignoreCache?: boolean,
        userInitiated?: boolean,
        quietMode?: boolean,
        clearTestStatus?: boolean,
    ) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }

        if (testManager.status === TestStatus.Discovering || testManager.status === TestStatus.Running) {
            return;
        }

        if (!this.testResultDisplay) {
            this.testResultDisplay = this.serviceContainer.get<ITestResultDisplay>(ITestResultDisplay);
        }
        const discoveryPromise = testManager.discoverTests(
            cmdSource,
            ignoreCache,
            quietMode,
            userInitiated,
            clearTestStatus,
        );
        this.testResultDisplay
            .displayDiscoverStatus(discoveryPromise, quietMode)
            .catch((ex) => traceError('Python Extension: displayDiscoverStatus', ex));
        await discoveryPromise;
    }
    public async stopTests(resource: Uri) {
        sendTelemetryEvent(EventName.UNITTEST_STOP);
        const testManager = await this.getTestManager(true, resource);
        if (testManager) {
            testManager.stop();
        }
    }
    public async displayStopUI(message: string): Promise<void> {
        const testManager = await this.getTestManager(true);
        if (!testManager) {
            return;
        }

        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        testDisplay.displayStopTestUI(testManager.workspaceFolder, message);
    }
    public async displayUI(cmdSource: constants.CommandSource) {
        const testManager = await this.getTestManager(true);
        if (!testManager) {
            return;
        }

        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        testDisplay.displayTestUI(cmdSource, testManager.workspaceFolder);
    }
    public async displayPickerUI(
        cmdSource: constants.CommandSource,
        file: Uri,
        testFunctions: TestFunction[],
        debug?: boolean,
    ) {
        const testManager = await this.getTestManager(true, file);
        if (!testManager) {
            return;
        }

        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        testDisplay.displayFunctionTestPickerUI(
            cmdSource,
            testManager.workspaceFolder,
            testManager.workingDirectory,
            file,
            testFunctions,
            debug,
        );
    }
    public async runParametrizedTests(
        cmdSource: constants.CommandSource,
        resource: Uri,
        testFunctions: TestFunction[],
        debug?: boolean,
    ) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }
        await this.runTestsImpl(cmdSource, resource, { testFunction: testFunctions }, undefined, debug);
    }
    public viewOutput(_cmdSource: constants.CommandSource) {
        sendTelemetryEvent(EventName.UNITTEST_VIEW_OUTPUT);
        this.outputChannel.show();
    }
    public async selectAndRunTestMethod(cmdSource: constants.CommandSource, resource: Uri, debug?: boolean) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }
        try {
            await testManager.discoverTests(cmdSource, true, true, true);
        } catch (ex) {
            return;
        }

        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(
            ITestCollectionStorageService,
        );
        const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        const selectedTestFn = await testDisplay.selectTestFunction(testManager.workspaceFolder.fsPath, tests);
        if (!selectedTestFn) {
            return;
        }

        await this.runTestsImpl(
            cmdSource,
            testManager.workspaceFolder,

            { testFunction: [selectedTestFn.testFunction] } as TestsToRun,
            false,
            debug,
        );
    }
    public async selectAndRunTestFile(cmdSource: constants.CommandSource) {
        const testManager = await this.getTestManager(true);
        if (!testManager) {
            return;
        }
        try {
            await testManager.discoverTests(cmdSource, true, true, true);
        } catch (ex) {
            return;
        }

        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(
            ITestCollectionStorageService,
        );
        const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
        const testDisplay = this.serviceContainer.get<ITestDisplay>(ITestDisplay);
        const selectedFile = await testDisplay.selectTestFile(testManager.workspaceFolder.fsPath, tests);
        if (!selectedFile) {
            return;
        }
        await this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [selectedFile] });
    }
    public async runCurrentTestFile(cmdSource: constants.CommandSource) {
        if (!this.documentManager.activeTextEditor) {
            return;
        }
        const testManager = await this.getTestManager(true, this.documentManager.activeTextEditor.document.uri);
        if (!testManager) {
            return;
        }
        try {
            await testManager.discoverTests(cmdSource, true, true, true);
        } catch (ex) {
            return;
        }
        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(
            ITestCollectionStorageService,
        );
        const tests = testCollectionStorage.getTests(testManager.workspaceFolder)!;
        const testFiles = tests.testFiles.filter((testFile) => {
            return testFile.fullPath === this.documentManager.activeTextEditor!.document.uri.fsPath;
        });
        if (testFiles.length < 1) {
            return;
        }
        await this.runTestsImpl(cmdSource, testManager.workspaceFolder, { testFile: [testFiles[0]] });
    }

    public async runTestsImpl(
        cmdSource: constants.CommandSource,
        resource?: Uri,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug: boolean = false,
    ) {
        const testManager = await this.getTestManager(true, resource);
        if (!testManager) {
            return;
        }

        if (!this.testResultDisplay) {
            this.testResultDisplay = this.serviceContainer.get<ITestResultDisplay>(ITestResultDisplay);
        }

        const promise = testManager.runTest(cmdSource, testsToRun, runFailedTests, debug).catch((reason) => {
            if (reason !== CANCELLATION_REASON) {
                this.outputChannel.appendLine(`Error: ${reason}`);
            }
            return Promise.reject(reason);
        });

        this.testResultDisplay.displayProgressStatus(promise, debug);
        await promise;
    }

    public async registerSymbolProvider(symbolProvider: DocumentSymbolProvider): Promise<void> {
        const testCollectionStorage = this.serviceContainer.get<ITestCollectionStorageService>(
            ITestCollectionStorageService,
        );
        const event = new EventEmitter<void>();
        this.disposableRegistry.push(event);
        const handler = this._onDidStatusChange.event((e) => {
            if (e.status !== TestStatus.Discovering && e.status !== TestStatus.Running) {
                event.fire();
            }
        });
        this.disposableRegistry.push(handler);
        this.disposableRegistry.push(
            activateCodeLenses(event, symbolProvider, testCollectionStorage, this.serviceContainer),
        );
    }

    @captureTelemetry(EventName.UNITTEST_CONFIGURE, undefined, false)
    public async configureTests(resource?: Uri) {
        let wkspace: Uri | undefined;
        if (resource) {
            const wkspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
            wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
        } else {
            const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            wkspace = await selectTestWorkspace(appShell);
        }
        if (!wkspace) {
            return;
        }
        const configurationService = this.serviceContainer.get<ITestConfigurationService>(ITestConfigurationService);
        await configurationService.promptToEnableAndConfigureTestFramework(wkspace!);
    }

    public registerCommands(): void {
        const disposablesRegistry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);

        const disposables = [
            commandManager.registerCommand(
                constants.Commands.Tests_Discover,
                (
                    treeNode?: TestWorkspaceFolder,
                    cmdSource: constants.CommandSource = constants.CommandSource.commandPalette,
                    resource?: Uri,
                ) => {
                    if (treeNode && treeNode instanceof TestWorkspaceFolder) {
                        resource = treeNode.resource;
                        cmdSource = constants.CommandSource.testExplorer;
                    }
                    // Ignore the exceptions returned.
                    // This command will be invoked from other places of the extension.
                    return this.discoverTests(cmdSource, resource, true, true, false, true).ignoreErrors();
                },
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Configure,
                (_, _cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource?: Uri) => {
                    // Ignore the exceptions returned.
                    // This command will be invoked from other places of the extension.
                    this.configureTests(resource).ignoreErrors();
                },
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Run_Failed,
                (_, cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource: Uri) =>
                    this.runTestsImpl(cmdSource, resource, undefined, true),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Run,
                (
                    treeNode?: TestWorkspaceFolder,
                    cmdSource: constants.CommandSource = constants.CommandSource.commandPalette,
                    resource?: Uri,
                    testToRun?: TestsToRun,
                ) => {
                    if (treeNode && treeNode instanceof TestWorkspaceFolder) {
                        resource = treeNode.resource;
                        cmdSource = constants.CommandSource.testExplorer;
                    }
                    return this.runTestsImpl(cmdSource, resource, testToRun);
                },
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Debug,
                (
                    treeNode?: TestWorkspaceFolder,
                    cmdSource: constants.CommandSource = constants.CommandSource.commandPalette,
                    resource?: Uri,
                    testToRun?: TestsToRun,
                ) => {
                    if (treeNode && treeNode instanceof TestWorkspaceFolder) {
                        resource = treeNode.resource;
                        cmdSource = constants.CommandSource.testExplorer;
                    }
                    return this.runTestsImpl(cmdSource, resource, testToRun, false, true);
                },
            ),
            commandManager.registerCommand(constants.Commands.Tests_View_UI, () =>
                this.displayUI(constants.CommandSource.commandPalette),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Picker_UI,
                (
                    _,
                    cmdSource: constants.CommandSource = constants.CommandSource.commandPalette,
                    file: Uri,
                    testFunctions: TestFunction[],
                ) => this.displayPickerUI(cmdSource, file, testFunctions),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Picker_UI_Debug,
                (
                    _,
                    cmdSource: constants.CommandSource = constants.CommandSource.commandPalette,
                    file: Uri,
                    testFunctions: TestFunction[],
                ) => this.displayPickerUI(cmdSource, file, testFunctions, true),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Run_Parametrized,
                (
                    _,
                    cmdSource: constants.CommandSource = constants.CommandSource.commandPalette,
                    resource: Uri,
                    testFunctions: TestFunction[],
                    debug: boolean,
                ) => this.runParametrizedTests(cmdSource, resource, testFunctions, debug),
            ),
            commandManager.registerCommand(constants.Commands.Tests_Stop, (_, resource: Uri) =>
                this.stopTests(resource),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_ViewOutput,
                (_, cmdSource: constants.CommandSource = constants.CommandSource.commandPalette) =>
                    this.viewOutput(cmdSource),
            ),
            commandManager.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () =>
                this.displayStopUI('Stop discovering tests'),
            ),
            commandManager.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () =>
                this.displayStopUI('Stop running tests'),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Select_And_Run_Method,
                (_, cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource: Uri) =>
                    this.selectAndRunTestMethod(cmdSource, resource),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Select_And_Debug_Method,
                (_, cmdSource: constants.CommandSource = constants.CommandSource.commandPalette, resource: Uri) =>
                    this.selectAndRunTestMethod(cmdSource, resource, true),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Select_And_Run_File,
                (_, cmdSource: constants.CommandSource = constants.CommandSource.commandPalette) =>
                    this.selectAndRunTestFile(cmdSource),
            ),
            commandManager.registerCommand(
                constants.Commands.Tests_Run_Current_File,
                (_, cmdSource: constants.CommandSource = constants.CommandSource.commandPalette) =>
                    this.runCurrentTestFile(cmdSource),
            ),
            commandManager.registerCommand(constants.Commands.Tests_Discovering, noop),
        ];

        disposablesRegistry.push(...disposables);
    }
    public onDocumentSaved(doc: TextDocument) {
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(doc.uri);
        if (!settings.testing.autoTestDiscoverOnSaveEnabled) {
            return;
        }
        this.discoverTestsForDocument(doc).ignoreErrors();
    }
    public registerHandlers() {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);

        this.disposableRegistry.push(documentManager.onDidSaveTextDocument(this.onDocumentSaved.bind(this)));
        this.disposableRegistry.push(
            this.workspaceService.onDidChangeConfiguration((e) => {
                if (this.configChangedTimer) {
                    clearTimeout(this.configChangedTimer as any);
                }
                this.configChangedTimer = setTimeout(() => this.configurationChangeHandler(e), 1000);
            }),
        );
        this.disposableRegistry.push(
            interpreterService.onDidChangeInterpreter(() =>
                this.autoDiscoverTests(undefined).catch((ex) =>
                    traceError('Failed to auto discover tests upon changing interpreter', ex),
                ),
            ),
        );
    }
}
