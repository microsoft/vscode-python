// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { CommandSource } from '../../../client/unittests/common/constants';
import { ITestManagerFactory, TestFile, TestsToRun } from '../../../client/unittests/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { MockProcessService } from '../../mocks/proc';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const PYTEST_RESULTS_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'pytestFiles', 'results');

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - pytest - run with mocked process output', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        ioc.dispose();
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

    async function injectTestDiscoveryOutput(outputFileName: string) {
        const procService = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create() as MockProcessService;
        procService.onExecObservable((file, args, options, callback) => {
            if (args.indexOf('--collect-only') >= 0) {
                callback({
                    out: fs.readFileSync(path.join(PYTEST_RESULTS_PATH, outputFileName), 'utf8').replace(/\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles\/testFiles\/noseFiles/g, PYTEST_RESULTS_PATH),
                    source: 'stdout'
                });
            }
        });
    }

    async function injectTestRunOutput(outputFileName: string, failedOutput: boolean = false) {
        const procService = await ioc.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create() as MockProcessService;
        procService.onExecObservable((file, args, options, callback) => {
            if (failedOutput && args.indexOf('--last-failed') === -1) {
                return;
            }

            const index = args.findIndex(arg => arg.startsWith('--junitxml='));
            if (index >= 0) {
                const fileName = args[index].substr('--junitxml='.length);
                const contents = fs.readFileSync(path.join(PYTEST_RESULTS_PATH, outputFileName), 'utf8');
                fs.writeFileSync(fileName, contents, 'utf8');
                callback({ out: '', source: 'stdout' });
            }
        });
    }

    test('Run Tests', async () => {
        await injectTestDiscoveryOutput('one.output');
        await injectTestRunOutput('one.xml');
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 9, 'Failures');
        assert.equal(results.summary.passed, 17, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');
    });

    test('Run Failed Tests', async () => {
        await injectTestDiscoveryOutput('two.output');
        await injectTestRunOutput('two.xml');
        await injectTestRunOutput('two.again.xml', true);
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        let results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 9, 'Failures');
        assert.equal(results.summary.passed, 17, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');

        results = await testManager.runTest(CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 0, 'Failed Errors');
        assert.equal(results.summary.failures, 9, 'Failed Failures');
        assert.equal(results.summary.passed, 0, 'Failed Passed');
        assert.equal(results.summary.skipped, 0, 'Failed skipped');
    });

    test('Run Specific Test File', async () => {
        await injectTestDiscoveryOutput('three.output');
        await injectTestRunOutput('three.xml');
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        await testManager.discoverTests(CommandSource.ui, true, true);
        const testFile: TestFile = {
            fullPath: path.join(UNITTEST_TEST_FILES_PATH, 'tests', 'test_another_pytest.py'),
            name: 'tests/test_another_pytest.py',
            nameToRun: 'tests/test_another_pytest.py',
            xmlName: 'tests/test_another_pytest.py',
            functions: [],
            suites: [],
            time: 0
        };
        const testFileToRun: TestsToRun = { testFile: [testFile], testFolder: [], testFunction: [], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFileToRun);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });

    test('Run Specific Test Suite', async () => {
        await injectTestDiscoveryOutput('four.output');
        await injectTestRunOutput('four.xml');
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuites[0].testSuite] };
        const results = await testManager.runTest(CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        await injectTestDiscoveryOutput('five.output');
        await injectTestRunOutput('five.xml');
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });
});
