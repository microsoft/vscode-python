// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as vscode from 'vscode';
import { CommandSource, EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { ITestManagerFactory } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { MockProcessService } from '../../mocks/proc';
import { registerForIOC } from '../../pythonEnvironments/legacyIOC';
import { lookForTestFile } from '../helper';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';

const PYTHON_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles');
const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'single',
);
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids'),
];

suite('Unit Tests - nose - discovery with mocked process output', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        filesToDelete.forEach((file) => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await initialize();
    });
    suiteTeardown(async () => {
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
        filesToDelete.forEach((file) => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });
    setup(async () => {
        await initializeTest();
        await initializeDI();
    });
    teardown(async () => {
        await ioc.dispose();
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
    });

    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();

        ioc.registerMockProcessTypes();
        ioc.registerInterpreterStorageTypes();

        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService)),
        );

        await registerForIOC(ioc.serviceManager, ioc.serviceContainer);
        ioc.serviceManager.rebindInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
    }

    async function injectTestDiscoveryOutput(outputFileName: string) {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        procService.onExecObservable((_file, args, _options, callback) => {
            if (args.indexOf('--collect-only') >= 0) {
                let out = fs.readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8');
                // Value in the test files.
                out = out.replace(
                    /\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles/g,
                    PYTHON_FILES_PATH,
                );
                callback({
                    out,
                    source: 'stdout',
                });
            }
        });
    }

    test('Discover Tests (single test file)', async () => {
        await injectTestDiscoveryOutput('one.output');
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        lookForTestFile(tests, path.join('tests', 'test_one.py'));
    });

    test('Check that nameToRun in testSuites has class name after : (single test file)', async () => {
        await injectTestDiscoveryOutput('two.output');
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(
            tests.testSuites.every((t) => t.testSuite.name === t.testSuite.nameToRun.split(':')[1]),
            true,
            'Suite name does not match class name',
        );
    });
    test('Discover Tests (-m=test)', async () => {
        await injectTestDiscoveryOutput('three.output');
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 5, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 16, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 6, 'Incorrect number of test suites');
        lookForTestFile(tests, path.join('tests', 'test_unittest_one.py'));
        lookForTestFile(tests, path.join('tests', 'test_unittest_two.py'));
        lookForTestFile(tests, path.join('tests', 'unittest_three_test.py'));
        lookForTestFile(tests, path.join('tests', 'test4.py'));
        lookForTestFile(tests, 'test_root.py');
    });

    test('Discover Tests (-w=specific -m=tst)', async () => {
        await injectTestDiscoveryOutput('four.output');
        await updateSetting('testing.nosetestArgs', ['-w', 'specific', '-m', 'tst'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        lookForTestFile(tests, path.join('specific', 'tst_unittest_one.py'));
        lookForTestFile(tests, path.join('specific', 'tst_unittest_two.py'));
    });

    test('Discover Tests (-m=test_)', async () => {
        await injectTestDiscoveryOutput('five.output');
        await updateSetting('testing.nosetestArgs', ['-m', 'test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('nosetest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        lookForTestFile(tests, 'test_root.py');
    });
});
