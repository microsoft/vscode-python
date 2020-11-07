// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { PythonEnvironments } from '../../../client/pythonEnvironments';
import { CondaService } from '../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { registerForIOC } from '../../../client/pythonEnvironments/legacyIOC';
import { CommandSource } from '../../../client/testing/common/constants';
import { ITestManagerFactory } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { MockProcessService } from '../../mocks/proc';
import { UnitTestIocContainer } from '../serviceRegistry';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../../initialize';

const testFilesPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(testFilesPath, 'single');
const unitTestTestFilesCwdPath = path.join(testFilesPath, 'cwd', 'src');
const defaultUnitTestArgs = ['-v', '-s', '.', '-p', '*test*.py'];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - unittest - discovery with mocked process output', () => {
    let ioc: UnitTestIocContainer;
    let pythonEnvs: PythonEnvironments;
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

    suiteSetup(async () => {
        await initialize();
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        const cachePath = path.join(UNITTEST_TEST_FILES_PATH, '.cache');
        if (await fs.pathExists(cachePath)) {
            await fs.remove(cachePath);
        }
        await initializeTest();
        pythonEnvs = mock(PythonEnvironments);
        initializeDI();
    });
    teardown(async () => {
        await ioc.dispose();
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();

        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.registerInterpreterStorageTypes();
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService))
        );
        registerForIOC(ioc.serviceManager, ioc.serviceContainer, instance(pythonEnvs));
        ioc.serviceManager.rebindInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
    }

    async function injectTestDiscoveryOutput(output: string) {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        procService.onExecObservable((_file, args, _options, callback) => {
            if (
                args.length > 1 &&
                args[0] === '-c' &&
                args[1].includes('import unittest') &&
                args[1].includes('loader = unittest.TestLoader()')
            ) {
                callback({
                    // Ensure any spaces added during code formatting or the like are removed.
                    out: output
                        .split(/\r?\n/g)
                        .map((item) => item.trim())
                        .join(EOL),
                    source: 'stdout'
                });
            }
        });
    }

    test('Discover Tests (single test file)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`start
    test_one.Test_test1.test_A
    test_one.Test_test1.test_B
    test_one.Test_test1.test_c
    `);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_one.py' && t.nameToRun === 'test_one'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFunctions.some(
                (t) => t.testFunction.name === 'test_A' && t.testFunction.nameToRun === 'test_one.Test_test1.test_A'
            ),
            true,
            'Test File not found'
        );
    });

    test('Discover Tests', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`start
    test_unittest_one.Test_test1.test_A
    test_unittest_one.Test_test1.test_B
    test_unittest_one.Test_test1.test_c
    test_unittest_two.Test_test2.test_A2
    test_unittest_two.Test_test2.test_B2
    test_unittest_two.Test_test2.test_C2
    test_unittest_two.Test_test2.test_D2
    test_unittest_two.Test_test2a.test_222A2
    test_unittest_two.Test_test2a.test_222B2
    `);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, rootDirectory);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 3, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_unittest_one.py' && t.nameToRun === 'test_unittest_one'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_unittest_two.py' && t.nameToRun === 'test_unittest_two'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFunctions.some(
                (t) =>
                    t.testFunction.name === 'test_A' &&
                    t.testFunction.nameToRun === 'test_unittest_one.Test_test1.test_A'
            ),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFunctions.some(
                (t) =>
                    t.testFunction.name === 'test_A2' &&
                    t.testFunction.nameToRun === 'test_unittest_two.Test_test2.test_A2'
            ),
            true,
            'Test File not found'
        );
    });

    test('Discover Tests (pattern = *_test_*.py)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=*_test*.py'], rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`start
    unittest_three_test.Test_test3.test_A
    unittest_three_test.Test_test3.test_B
    `);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, rootDirectory);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'unittest_three_test.py' && t.nameToRun === 'unittest_three_test'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFunctions.some(
                (t) =>
                    t.testFunction.name === 'test_A' &&
                    t.testFunction.nameToRun === 'unittest_three_test.Test_test3.test_A'
            ),
            true,
            'Test File not found'
        );
    });

    test('Setting cwd should return tests', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        await injectTestDiscoveryOutput(`start
    test_cwd.Test_Current_Working_Directory.test_cwd
    `);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('unittest', rootWorkspaceUri!, unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    });
});
