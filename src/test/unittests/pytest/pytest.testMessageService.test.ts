// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { ProductNames } from '../../../client/common/installer/productNames';
import { Product } from '../../../client/common/types';
import { TestResultsService } from '../../../client/unittests/common/services/testResultsService';
import { TestsHelper } from '../../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../../client/unittests/common/testVisitors/flatteningVisitor';
import { ITestVisitor, PassCalculationFormulae, TestDiscoveryOptions, Tests, TestStatus } from '../../../client/unittests/common/types';
import { XUnitParser } from '../../../client/unittests/common/xUnitParser';
import { TestsParser as PyTestsParser } from '../../../client/unittests/pytest/services/parserService';
import { TestMessageService } from '../../../client/unittests/pytest/services/testMessageService';
import { ILocationStackFrameDetails, IPythonUnitTestMessage, PythonUnitTestMessageSeverity } from '../../../client/unittests/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';
import { UnitTestIocContainer } from '../serviceRegistry';
import { ITestDetails, testScenarios } from './pytest_run_tests_data';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const PYTEST_RESULTS_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'pytestFiles', 'results');

const filterdTestScenarios = testScenarios.filter((ts) => { return !ts.shouldRunFailed; });

async function testMessageProperties(message: IPythonUnitTestMessage, expectedMessage: IPythonUnitTestMessage, imported: boolean = false, status: TestStatus) {
    assert.equal(message.code, expectedMessage.code, 'IPythonUnitTestMessage code');
    assert.equal(message.message, expectedMessage.message, 'IPythonUnitTestMessage message');
    assert.equal(message.severity, expectedMessage.severity, 'IPythonUnitTestMessage severity');
    assert.equal(message.provider, expectedMessage.provider, 'IPythonUnitTestMessage provider');
    assert.isNumber(message.testTime, 'IPythonUnitTestMessage testTime');
    assert.equal(message.status, expectedMessage.status, 'IPythonUnitTestMessage status');
    assert.equal(message.testFilePath, expectedMessage.testFilePath, 'IPythonUnitTestMessage testFilePath');
    if (status !== TestStatus.Pass) {
        assert.equal(message.locationStack![0].lineText, expectedMessage.locationStack![0].lineText, 'IPythonUnitTestMessage line text');
        assert.equal(message.locationStack![0].location.uri.fsPath, expectedMessage.locationStack![0].location.uri.fsPath, 'IPythonUnitTestMessage locationStack fsPath');
        if (status !== TestStatus.Skipped) {
            assert.equal(message.locationStack![1].lineText, expectedMessage.locationStack![1].lineText, 'IPythonUnitTestMessage line text');
            assert.equal(message.locationStack![1].location.uri.fsPath, expectedMessage.locationStack![1].location.uri.fsPath, 'IPythonUnitTestMessage locationStack fsPath');
        }
        if (imported) {
            assert.equal(message.locationStack![2].lineText, expectedMessage.locationStack![2].lineText, 'IPythonUnitTestMessage imported line text');
            assert.equal(message.locationStack![2].location.uri.fsPath, expectedMessage.locationStack![2].location.uri.fsPath, 'IPythonUnitTestMessage imported location fsPath');
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
async function getExpectedLocationStackFromTestDetails(testDetails: ITestDetails): Promise<ILocationStackFrameDetails[]> {
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
        locationStack.push(
            {
                location: new vscode.Location(testFileUri, testDetails.classDefRange!),
                lineText: testDetails.simpleClassName!
            }
        );
    }
    locationStack.push(
        {
            location: new vscode.Location(expectedSourceTestFileUri, testDetails.testDefRange!),
            lineText: testDetails.sourceTestName
        }
    );
    if (testDetails.status !== TestStatus.Skipped) {
        locationStack.push(
            {
                location: new vscode.Location(expectedSourceTestFileUri, testDetails.issueRange!),
                lineText: testDetails.issueLineText!
            }
        );
    }
    return locationStack;
}

suite('Unit Tests - PyTest - TestMessageService', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        // Mocks.
        ioc.registerMockProcessTypes();
    }
    // Build tests for the test data that is relevant for this platform.
    filterdTestScenarios.forEach((scenario) => {
        suite(scenario.scenarioName, async () => {
            let testMessages: IPythonUnitTestMessage[];
            suiteSetup(async () => {
                await initializeTest();
                initializeDI();
                // Setup the service container for use by the parser.
                const testVisitor = typeMoq.Mock.ofType<ITestVisitor>();
                const outChannel = typeMoq.Mock.ofType<vscode.OutputChannel>();
                const cancelToken = typeMoq.Mock.ofType<vscode.CancellationToken>();
                cancelToken.setup(c => c.isCancellationRequested).returns(() => false);
                const wsFolder = typeMoq.Mock.ofType<vscode.Uri>();
                const options: TestDiscoveryOptions = {
                    args: [],
                    cwd: UNITTEST_TEST_FILES_PATH,
                    ignoreCache: true,
                    outChannel: outChannel.object,
                    token: cancelToken.object,
                    workspaceFolder: wsFolder.object
                };
                // Setup the parser.
                const testFlattener: TestFlatteningVisitor = new TestFlatteningVisitor();
                const testHlp: TestsHelper = new TestsHelper(testFlattener, ioc.serviceContainer);
                const parser = new PyTestsParser(testHlp);
                const discoveryOutput = fs.readFileSync(path.join(PYTEST_RESULTS_PATH, scenario.discoveryOutput), 'utf8').replace(/\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles\/testFiles\/noseFiles/g, PYTEST_RESULTS_PATH);
                const parsedTests: Tests = parser.parse(discoveryOutput, options);
                const xUnitParser = new XUnitParser();
                await xUnitParser.updateResultsFromXmlLogFile(parsedTests, path.join(PYTEST_RESULTS_PATH, scenario.runOutput), PassCalculationFormulae.pytest);
                const testResultsService = new TestResultsService(testVisitor.object);
                testResultsService.updateResults(parsedTests);
                const testMessageService = new TestMessageService(ioc.serviceContainer);
                testMessages = await testMessageService.getFilteredTestMessages(UNITTEST_TEST_FILES_PATH, parsedTests);
            });
            suiteTeardown(async () => {
                await ioc.dispose();
                await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
            });
            scenario.testDetails!.forEach((td) => {
                suite(td.nameToRun, () => {
                    let testMessage: IPythonUnitTestMessage;
                    let expectedMessage: IPythonUnitTestMessage;
                    suiteSetup(async () => {
                        let expectedSeverity: PythonUnitTestMessageSeverity;
                        if (td.status === TestStatus.Error || td.status === TestStatus.Fail) {
                            expectedSeverity = PythonUnitTestMessageSeverity.Error;
                        } else if (td.status === TestStatus.Skipped) {
                            expectedSeverity = PythonUnitTestMessageSeverity.Skip;
                        } else {
                            expectedSeverity = PythonUnitTestMessageSeverity.Pass;
                        }
                        const expectedLocationStack = await getExpectedLocationStackFromTestDetails(td);
                        expectedMessage = {
                            code: td.nameToRun,
                            message: td.message,
                            severity: expectedSeverity,
                            provider: ProductNames.get(Product.pytest)!,
                            testTime: 0,
                            status: td.status,
                            locationStack: expectedLocationStack,
                            testFilePath: path.join(UNITTEST_TEST_FILES_PATH, td.fileName)
                        };
                        testMessage = testMessages.find(tm => tm.code === td.nameToRun)!;
                    });
                    test('Message', async () => {
                        await testMessageProperties(testMessage, expectedMessage, td.imported, td.status);
                    });
                });
            });
        });
    });
});
