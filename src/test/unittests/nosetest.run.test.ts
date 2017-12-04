// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IProcessService } from '../../client/common/process/types';
import { CommandSource } from '../../client/unittests/common/constants';
import { ITestManagerFactory, TestsToRun } from '../../client/unittests/common/types';
import { rootWorkspaceUri, updateSetting } from '../common';
import { MockProcessService } from '../mocks/proc';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { UnitTestIocContainer } from './serviceRegistry';

const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - nose - run against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await initialize();
    });
    suiteTeardown(async () => {
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        ioc.dispose();
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();

        ioc.registerMockProcessTypes();
    }

    function injectTestDiscoveryOutput(outputFileName: string) {
        const procService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        procService.onExecObservable((file, args, options, callback) => {
            if (args.indexOf('--collect-only') >= 0) {
                callback({
                    out: fs.readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8'),
                    source: 'stdout'
                });
            }
        });
    }

    function injectTestRunOutput(outputFileName: string, failedOutput: boolean = false) {
        const procService = ioc.serviceContainer.get<MockProcessService>(IProcessService);
        procService.onExecObservable((file, args, options, callback) => {
            if (failedOutput && args.indexOf('--failed') === -1) {
                return;
            }

            const index = args.findIndex(arg => arg.startsWith('--xunit-file='));
            if (index >= 0) {
                const fileName = args[index].substr('--xunit-file='.length);
                const contents = fs.readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8');
                fs.writeFileSync(fileName, contents, 'utf8');
                callback({ out: '', source: 'stdout' });
            }
        });
    }

    test('Run Tests', async () => {
        injectTestDiscoveryOutput('run.one.output');
        injectTestRunOutput('run.one.result');
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');
    });

    test('Run Failed Tests', async () => {
        injectTestDiscoveryOutput('run.two.output');
        injectTestRunOutput('run.two.result');
        injectTestRunOutput('run.two.again.result', true);
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        let results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');

        results = await testManager.runTest(CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 1, 'Errors again');
        assert.equal(results.summary.failures, 7, 'Failures again');
        assert.equal(results.summary.passed, 0, 'Passed again');
        assert.equal(results.summary.skipped, 0, 'skipped again');
    });

    test('Run Specific Test File', async () => {
        injectTestDiscoveryOutput('run.three.output');
        injectTestRunOutput('run.three.result');
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFileToRun = tests.testFiles.find(t => t.fullPath.endsWith('test_root.py'));
        assert.ok(testFileToRun, 'Test file not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFile: TestsToRun = { testFile: [testFileToRun!], testFolder: [], testFunction: [], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFile);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Suite', async () => {
        injectTestDiscoveryOutput('run.four.output');
        injectTestRunOutput('run.four.result');
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testSuiteToRun = tests.testSuites.find(s => s.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testSuiteToRun, 'Test suite not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [testSuiteToRun!.testSuite] };
        const results = await testManager.runTest(CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        injectTestDiscoveryOutput('run.five.output');
        injectTestRunOutput('run.five.result');
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFnToRun = tests.testFunctions.find(f => f.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testFnToRun, 'Test function not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [testFnToRun!.testFunction], testSuite: [] };
        const results = await testManager.runTest(CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });
});
