'use strict';
import { Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';
import { IUnitTestSettings, PythonSettings } from '../common/configSettings';
import * as constants from '../common/constants';
import { PythonSymbolProvider } from '../providers/symbolProvider';
import { activateCodeLenses } from './codeLenses/main';
import { BaseTestManager } from './common/baseTestManager';
import { CANCELLATION_REASON } from './common/constants';
import { DebugLauncher } from './common/debugLauncher';
import { TestCollectionStorageService } from './common/storageService';
import { TestManagerServiceFactory } from './common/testManagerServiceFactory';
import { TestResultsService } from './common/testResultsService';
import { selectTestWorkspace, TestsHelper } from './common/testUtils';
import { FlattenedTestFunction, ITestCollectionStorageService, IWorkspaceTestManagerService, TestFile, TestFunction, TestStatus, TestsToRun } from './common/types';
import { WorkspaceTestManagerService } from './common/workspaceTestManagerService';
import { displayTestFrameworkError } from './configuration';
import { TestResultDisplay } from './display/main';
import { TestDisplay } from './display/picker';
import * as nosetests from './nosetest/main';
import * as pytest from './pytest/main';
import * as unittest from './unittest/main';

let workspaceTestManagerService: IWorkspaceTestManagerService;
let testResultDisplay: TestResultDisplay;
let testDisplay: TestDisplay;
let outChannel: vscode.OutputChannel;
const onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
let testCollectionStorage: ITestCollectionStorageService;

export function activate(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, symboldProvider: PythonSymbolProvider) {
    context.subscriptions.push({ dispose: dispose });
    outChannel = outputChannel;
    const disposables = registerCommands();
    context.subscriptions.push(...disposables);

    testCollectionStorage = new TestCollectionStorageService();
    const testResultsService = new TestResultsService();
    const testsHelper = new TestsHelper();
    const debugLauncher = new DebugLauncher();
    const testManagerServiceFactory = new TestManagerServiceFactory(outChannel, testCollectionStorage, testResultsService, testsHelper, debugLauncher);
    workspaceTestManagerService = new WorkspaceTestManagerService(outChannel, testManagerServiceFactory);

    context.subscriptions.push(autoResetTests());
    context.subscriptions.push(activateCodeLenses(onDidChange, symboldProvider, testCollectionStorage));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(onDocumentSaved));

    autoDiscoverTests();
}

async function getTestManager(displayTestNotConfiguredMessage: boolean, resource?: Uri): Promise<BaseTestManager | undefined | void> {
    let wkspace: Uri | undefined;
    if (resource) {
        const wkspaceFolder = workspace.getWorkspaceFolder(resource);
        wkspace = wkspaceFolder ? wkspaceFolder.uri : undefined;
    } else {
        wkspace = await selectTestWorkspace();
    }
    if (!wkspace) {
        return;
    }
    const testManager = workspaceTestManagerService.getTestManager(wkspace);
    if (testManager) {
        return testManager;
    }
    if (displayTestNotConfiguredMessage) {
        await displayTestFrameworkError(wkspace, outChannel);
    }
}
let timeoutId: number;
async function onDocumentSaved(doc: vscode.TextDocument): Promise<void> {
    const testManager = await getTestManager(false, doc.uri);
    if (!testManager) {
        return;
    }
    const tests = await testManager.discoverTests(false, true);
    if (!tests || !Array.isArray(tests.testFiles) || tests.testFiles.length === 0) {
        return;
    }
    if (tests.testFiles.findIndex((f: TestFile) => f.fullPath === doc.uri.fsPath) === -1) {
        return;
    }

    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => discoverTests(doc.uri, true), 1000);
}

function dispose() {
    workspaceTestManagerService.dispose();
    testCollectionStorage.dispose();
}
function registerCommands(): vscode.Disposable[] {
    const disposables = [];
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Discover, (resource?: Uri) => {
        // Ignore the exceptions returned.
        // This command will be invoked else where in the extension.
        // tslint:disable-next-line:no-empty
        discoverTests(resource, true, true).catch(() => { });
    }));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Failed, (resource: Uri) => runTestsImpl(resource, undefined, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run, (file: Uri, testToRun?: TestsToRun) => runTestsImpl(file, testToRun)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Debug, (file: Uri, testToRun: TestsToRun) => runTestsImpl(file, testToRun, false, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_View_UI, () => displayUI()));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI, (file: Uri, testFunctions: TestFunction[]) => displayPickerUI(file, testFunctions)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Picker_UI_Debug, (file, testFunctions) => displayPickerUI(file, testFunctions, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Stop, (resource: Uri) => stopTests(resource)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_ViewOutput, () => outChannel.show()));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Discovery, () => displayStopUI('Stop discovering tests')));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Ask_To_Stop_Test, () => displayStopUI('Stop running tests')));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_Method, (resource: Uri) => selectAndRunTestMethod(resource)));
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Debug_Method, (resource: Uri) => selectAndRunTestMethod(resource, true)));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Select_And_Run_File, () => selectAndRunTestFile()));
    // tslint:disable-next-line:no-unnecessary-callback-wrapper
    disposables.push(vscode.commands.registerCommand(constants.Commands.Tests_Run_Current_File, () => runCurrentTestFile()));

    return disposables;
}

async function displayUI() {
    const testManager = await getTestManager(true);
    if (!testManager) {
        return;
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    testDisplay.displayTestUI(testManager.workspace);
}
async function displayPickerUI(file: Uri, testFunctions: TestFunction[], debug?: boolean) {
    const testManager = await getTestManager(true, file);
    if (!testManager) {
        return;
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    testDisplay.displayFunctionTestPickerUI(testManager.workspace, testManager.workingDirectory, file, testFunctions, debug);
}
async function selectAndRunTestMethod(resource: Uri, debug?: boolean) {
    const testManager = await getTestManager(true, resource);
    if (!testManager) {
        return;
    }
    try {
        await testManager.discoverTests(true, true, true);
    } catch (ex) {
        return;
    }

    const tests = testCollectionStorage.getTests(testManager.workspace);
    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    const selectedTestFn = await testDisplay.selectTestFunction(testManager.workspace.fsPath, tests);
    if (!selectedTestFn) {
        return;
    }
    // tslint:disable-next-line:prefer-type-cast
    await runTestsImpl(testManager.workspace, { testFunction: [selectedTestFn.testFunction] } as TestsToRun, debug);
}
async function selectAndRunTestFile() {
    const testManager = await getTestManager(true);
    if (!testManager) {
        return;
    }
    try {
        await testManager.discoverTests(true, true, true);
    } catch (ex) {
        return;
    }

    const tests = testCollectionStorage.getTests(testManager.workspace);
    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    const selectedFile = await testDisplay.selectTestFile(testManager.workspace.fsPath, tests);
    if (!selectedFile) {
        return;
    }
    // tslint:disable-next-line:prefer-type-cast
    await runTestsImpl(testManager.workspace, { testFile: [selectedFile] } as TestsToRun);
}
async function runCurrentTestFile() {
    if (!window.activeTextEditor) {
        return;
    }
    const testManager = await getTestManager(true, window.activeTextEditor.document.uri);
    if (!testManager) {
        return;
    }
    try {
        await testManager.discoverTests(true, true, true);
    } catch (ex) {
        return;
    }
    const tests = testCollectionStorage.getTests(testManager.workspace);
    const testFiles = tests.testFiles.filter(testFile => {
        return testFile.fullPath === window.activeTextEditor.document.uri.fsPath;
    });
    if (testFiles.length < 1) {
        return;
    }
    // tslint:disable-next-line:prefer-type-cast
    await runTestsImpl(testManager.workspace, { testFile: [testFiles[0]] } as TestsToRun);
}
async function displayStopUI(message: string) {
    const testManager = await getTestManager(true);
    if (!testManager) {
        return;
    }

    testDisplay = testDisplay ? testDisplay : new TestDisplay(testCollectionStorage);
    testDisplay.displayStopTestUI(testManager.workspace, message);
}

let uniTestSettingsString: string;
function autoResetTests() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length > 1) {
        // tslint:disable-next-line:no-empty
        return { dispose: () => { } };
    }

    const settings = PythonSettings.getInstance();
    uniTestSettingsString = JSON.stringify(settings.unitTest);
    return workspace.onDidChangeConfiguration(() => setTimeout(onConfigChanged, 1000));
}
function onConfigChanged() {
    // If there's one workspace, then stop the tests and restart,
    // else let the user do this manually.
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length > 1) {
        return;
    }
    const settings = PythonSettings.getInstance();

    // Possible that a test framework has been enabled or some settings have changed.
    // Meaning we need to re-load the discovered tests (as something could have changed).
    const newSettings = JSON.stringify(settings.unitTest);
    if (uniTestSettingsString === newSettings) {
        return;
    }

    uniTestSettingsString = newSettings;
    if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
        if (testResultDisplay) {
            testResultDisplay.enabled = false;
        }
        workspaceTestManagerService.dispose();
        return;
    }
    if (testResultDisplay) {
        testResultDisplay.enabled = true;
    }
    autoDiscoverTests();
}
function autoDiscoverTests() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length > 1) {
        return;
    }
    const settings = PythonSettings.getInstance();
    if (!settings.unitTest.nosetestsEnabled && !settings.unitTest.pyTestEnabled && !settings.unitTest.unittestEnabled) {
        return;
    }

    // No need to display errors.
    // tslint:disable-next-line:no-empty
    discoverTests(workspace.workspaceFolders[0].uri, true).catch(() => { });
}
async function stopTests(resource: Uri) {
    const testManager = await getTestManager(true, resource);
    if (testManager) {
        testManager.stop();
    }
}
async function discoverTests(resource?: Uri, ignoreCache?: boolean, userInitiated?: boolean) {
    const testManager = await getTestManager(true, resource);
    if (!testManager) {
        return;
    }

    if (testManager && (testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
        testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel, onDidChange);
        const discoveryPromise = testManager.discoverTests(ignoreCache, false, userInitiated);
        testResultDisplay.displayDiscoverStatus(discoveryPromise);
        await discoveryPromise;
    }
}
// tslint:disable-next-line:no-any
function isTestsToRun(arg: any): arg is TestsToRun {
    if (arg && arg.testFunction && Array.isArray(arg.testFunction)) {
        return true;
    }
    if (arg && arg.testSuite && Array.isArray(arg.testSuite)) {
        return true;
    }
    if (arg && arg.testFile && Array.isArray(arg.testFile)) {
        return true;
    }
    return false;
}
async function runTestsImpl(resource?: Uri, testsToRun?: TestsToRun, runFailedTests?: boolean, debug: boolean = false) {
    const testManager = await getTestManager(true, resource);
    if (!testManager) {
        return;
    }

    testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel, onDidChange);
    const promise = testManager.runTest(testsToRun, runFailedTests, debug)
        .catch(reason => {
            if (reason !== CANCELLATION_REASON) {
                outChannel.appendLine(`Error: ${reason}`);
            }
            return Promise.reject(reason);
        });

    testResultDisplay.displayProgressStatus(promise, debug);
    await promise;
}
