// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { ICondaService } from '../../../client/interpreter/contracts';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { InterpreterHashProvider } from '../../../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../../client/interpreter/locators/services/hashProviderFactory';
import { InterpreterFilter } from '../../../client/interpreter/locators/services/interpreterFilter';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';
import { CommandSource } from '../../../client/testing/common/constants';
import { ITestManagerFactory, TestsToRun } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { MockProcessService } from '../../mocks/proc';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'single'
);
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - nose - run against actual python process', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await initialize();
    });
    suiteTeardown(async () => {
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
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
        await ioc.dispose();
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();

        ioc.registerMockProcessTypes();
        ioc.registerMockInterpreterTypes();
        ioc.serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);

        ioc.serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
        ioc.serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
        ioc.serviceManager.addSingleton<InterpeterHashProviderFactory>(
            InterpeterHashProviderFactory,
            InterpeterHashProviderFactory
        );
        ioc.serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
    }

    async function injectTestDiscoveryOutput(outputFileName: string) {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        procService.onExecObservable((_file, args, _options, callback) => {
            if (args.indexOf('--collect-only') >= 0) {
                callback({
                    out: fs
                        .readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8')
                        .replace(
                            /\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles\/testFiles\/noseFiles/g,
                            UNITTEST_TEST_FILES_PATH
                        ),
                    source: 'stdout'
                });
            }
        });
    }

    async function injectTestRunOutput(outputFileName: string, failedOutput: boolean = false) {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        procService.onExecObservable((_file, args, _options, callback) => {
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
        await injectTestDiscoveryOutput('run.one.output');
        await injectTestRunOutput('run.one.result');
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const results = await testManager.runTest(CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');
    });

    test('Run Failed Tests', async () => {
        await injectTestDiscoveryOutput('run.two.output');
        await injectTestRunOutput('run.two.result');
        await injectTestRunOutput('run.two.again.result', true);
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
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
        await injectTestDiscoveryOutput('run.three.output');
        await injectTestRunOutput('run.three.result');
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
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
        await injectTestDiscoveryOutput('run.four.output');
        await injectTestRunOutput('run.four.result');
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testSuiteToRun = tests.testSuites.find(s => s.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testSuiteToRun, 'Test suite not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testSuite: TestsToRun = {
            testFile: [],
            testFolder: [],
            testFunction: [],
            testSuite: [testSuiteToRun!.testSuite]
        };
        const results = await testManager.runTest(CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        await injectTestDiscoveryOutput('run.five.output');
        await injectTestRunOutput('run.five.result');
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const testFnToRun = tests.testFunctions.find(f => f.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testFnToRun, 'Test function not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFn: TestsToRun = {
            testFile: [],
            testFolder: [],
            testFunction: [testFnToRun!.testFunction],
            testSuite: []
        };
        const results = await testManager.runTest(CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });
});
