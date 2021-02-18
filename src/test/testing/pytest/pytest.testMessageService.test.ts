// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as typeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { ProductNames } from '../../../client/common/installer/productNames';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { Product } from '../../../client/common/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { TestDiscoveredTestParser } from '../../../client/testing/common/services/discoveredTestParser';
import { TestResultsService } from '../../../client/testing/common/services/testResultsService';
import { DiscoveredTests } from '../../../client/testing/common/services/types';
import {
    FinalTestStatus,
    ILocationStackFrameDetails,
    IPythonTestMessage,
    ITestNonPassingMessage,
    ITestVisitor,
    PythonTestMessageSeverity,
    TestDiscoveryOptions,
    Tests,
    TestStatus,
} from '../../../client/testing/common/types';
import { XUnitParser } from '../../../client/testing/common/xUnitParser';
import { TestMessageService } from '../../../client/testing/pytest/services/testMessageService';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';
import { UnitTestIocContainer } from '../serviceRegistry';
import { ITestDetails, testScenarios } from './pytest_run_tests_data';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const PYTEST_RESULTS_PATH = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'pytestFiles',
    'results',
);

const filterdTestScenarios = testScenarios.filter((ts) => {
    return !ts.shouldRunFailed;
});

async function testMessageProperties(
    message: IPythonTestMessage,
    expectedMessage: IPythonTestMessage,
    imported = false,
    status: TestStatus,
) {
    const nonPassing = message as ITestNonPassingMessage;
    const expectedNonPassing = expectedMessage as ITestNonPassingMessage;
    assert.equal(message.code, expectedMessage.code, 'IPythonTestMessage code');
    assert.equal(nonPassing.message, expectedNonPassing.message, 'IPythonTestMessage message');
    assert.equal(message.severity, expectedMessage.severity, 'IPythonTestMessage severity');
    assert.equal(message.provider, expectedMessage.provider, 'IPythonTestMessage provider');
    assert.isNumber(message.testTime, 'IPythonTestMessage testTime');
    assert.equal(message.status, expectedMessage.status, 'IPythonTestMessage status');
    assert.equal(message.testFilePath, expectedMessage.testFilePath, 'IPythonTestMessage testFilePath');
    if (status !== TestStatus.Pass) {
        assert.equal(
            nonPassing.locationStack[0].lineText,
            expectedNonPassing.locationStack[0].lineText,
            'IPythonTestMessage line text',
        );
        assert.equal(
            nonPassing.locationStack[0].location.uri.fsPath,
            expectedNonPassing.locationStack[0].location.uri.fsPath,
            'IPythonTestMessage locationStack fsPath',
        );
        if (status !== TestStatus.Skipped) {
            assert.equal(
                nonPassing.locationStack[1].lineText,
                expectedNonPassing.locationStack[1].lineText,
                'IPythonTestMessage line text',
            );
            assert.equal(
                nonPassing.locationStack[1].location.uri.fsPath,
                expectedNonPassing.locationStack[1].location.uri.fsPath,
                'IPythonTestMessage locationStack fsPath',
            );
        }
        if (imported) {
            assert.equal(
                nonPassing.locationStack[2].lineText,
                expectedNonPassing.locationStack[2].lineText,
                'IPythonTestMessage imported line text',
            );
            assert.equal(
                nonPassing.locationStack[2].location.uri.fsPath,
                expectedNonPassing.locationStack[2].location.uri.fsPath,
                'IPythonTestMessage imported location fsPath',
            );
        }
    }
}

/**
 * Generate a Diagnostic object (including DiagnosticRelatedInformation) using the provided test details that reflects
 * what the Diagnostic for the associated test should be in order for it to be compared to by the actual Diagnostic
 * for the test.
 *
 * @param testDetails Test details for a specific test.
 */
async function getExpectedLocationStackFromTestDetails(
    testDetails: ITestDetails,
): Promise<ILocationStackFrameDetails[]> {
    const locationStack: ILocationStackFrameDetails[] = [];
    const testFilePath = path.join(UNITTEST_TEST_FILES_PATH, testDetails.fileName);
    const testFileUri = vscode.Uri.file(testFilePath);
    let expectedSourceTestFilePath = testFilePath;
    if (testDetails.imported) {
        expectedSourceTestFilePath = path.join(UNITTEST_TEST_FILES_PATH, testDetails.sourceFileName!);
    }
    const expectedSourceTestFileUri = vscode.Uri.file(expectedSourceTestFilePath);
    if (testDetails.imported) {
        // Stack should include the class furthest down the chain from the file that was executed.
        locationStack.push({
            location: new vscode.Location(testFileUri, testDetails.classDefRange!),
            lineText: testDetails.simpleClassName!,
        });
    }
    locationStack.push({
        location: new vscode.Location(expectedSourceTestFileUri, testDetails.testDefRange!),
        lineText: testDetails.sourceTestName,
    });
    if (testDetails.status !== TestStatus.Skipped) {
        locationStack.push({
            location: new vscode.Location(expectedSourceTestFileUri, testDetails.issueRange!),
            lineText: testDetails.issueLineText!,
        });
    }
    return locationStack;
}

suite('Unit Tests - PyTest - TestMessageService', () => {
    let ioc: UnitTestIocContainer;
    const filesystem = new FileSystem();
    const configTarget = IS_MULTI_ROOT_TEST
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
    });
    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService)),
        );
    }
    // Build tests for the test data that is relevant for this platform.
    filterdTestScenarios.forEach((scenario) => {
        suite(scenario.scenarioName, async () => {
            let testMessages: IPythonTestMessage[];
            suiteSetup(async () => {
                await initializeTest();
                await initializeDI();
                // Setup the service container for use by the parser.
                const testVisitor = typeMoq.Mock.ofType<ITestVisitor>();
                const outChannel = typeMoq.Mock.ofType<vscode.OutputChannel>();
                const cancelToken = typeMoq.Mock.ofType<vscode.CancellationToken>();
                cancelToken.setup((c) => c.isCancellationRequested).returns(() => false);
                const options: TestDiscoveryOptions = {
                    args: [],
                    cwd: UNITTEST_TEST_FILES_PATH,
                    ignoreCache: true,
                    outChannel: outChannel.object,
                    token: cancelToken.object,
                    workspaceFolder: vscode.Uri.file(__dirname),
                };
                // Setup the parser.
                const workspaceService = ioc.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
                const parser = new TestDiscoveredTestParser(workspaceService);
                const discoveryOutput = fs
                    .readFileSync(path.join(PYTEST_RESULTS_PATH, scenario.discoveryOutput), 'utf8')
                    .replace(
                        /\/Users\/donjayamanne\/.vscode-insiders\/extensions\/pythonVSCode\/src\/test\/pythonFiles\/testFiles/g,
                        path.dirname(UNITTEST_TEST_FILES_PATH),
                    )
                    .replace(/\\/g, '/');
                const discoveredTest: DiscoveredTests[] = JSON.parse(discoveryOutput);
                options.workspaceFolder = vscode.Uri.file(discoveredTest[0].root);
                const parsedTests: Tests = parser.parse(options.workspaceFolder, discoveredTest);
                const xUnitParser = new XUnitParser(filesystem);
                await xUnitParser.updateResultsFromXmlLogFile(
                    parsedTests,
                    path.join(PYTEST_RESULTS_PATH, scenario.runOutput),
                );
                const testResultsService = new TestResultsService(testVisitor.object);
                testResultsService.updateResults(parsedTests);
                const testMessageService = new TestMessageService(ioc.serviceContainer);
                testMessages = await testMessageService.getFilteredTestMessages(UNITTEST_TEST_FILES_PATH, parsedTests);
            });
            suiteTeardown(async () => {
                await ioc.dispose();
                await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
            });
            scenario.testDetails!.forEach((td) => {
                suite(td.nameToRun, () => {
                    let testMessage: IPythonTestMessage;
                    let expectedMessage: IPythonTestMessage;
                    suiteSetup(async () => {
                        let expectedSeverity: PythonTestMessageSeverity;
                        if (td.status === TestStatus.Error || td.status === TestStatus.Fail) {
                            expectedSeverity = PythonTestMessageSeverity.Error;
                        } else if (td.status === TestStatus.Skipped) {
                            expectedSeverity = PythonTestMessageSeverity.Skip;
                        } else {
                            expectedSeverity = PythonTestMessageSeverity.Pass;
                        }
                        const expectedLocationStack = await getExpectedLocationStackFromTestDetails(td);
                        expectedMessage = {
                            code: td.nameToRun,
                            severity: expectedSeverity,
                            provider: ProductNames.get(Product.pytest)!,
                            testTime: 0,
                            status: td.status as FinalTestStatus,
                            testFilePath: path.join(UNITTEST_TEST_FILES_PATH, td.fileName),
                            // These are non-passing properties only:
                            message: td.message,
                            locationStack: expectedLocationStack,
                        } as IPythonTestMessage;
                        testMessage = testMessages.find((tm) => tm.code === td.nameToRun)!;
                    });
                    test('Message', async () => {
                        await testMessageProperties(testMessage, expectedMessage, td.imported, td.status);
                    });
                });
            });
        });
    });
});
