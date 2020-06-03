import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { ICondaService, IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { CondaService } from '../../client/pythonEnvironments/discovery/locators/services/condaService';
import { CommandSource } from '../../client/testing/common/constants';
import { ITestManagerFactory, TestProvider } from '../../client/testing/common/types';
import { deleteDirectory, deleteFile, rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST, TEST_TIMEOUT } from './../initialize';
import { UnitTestIocContainer } from './serviceRegistry';

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const testFile = path.join(testFilesPath, 'tests', 'test_debugger_two.py');
const testFileWithFewTests = path.join(testFilesPath, 'tests', 'test_debugger_two.txt');
const testFileWithMoreTests = path.join(testFilesPath, 'tests', 'test_debugger_two.updated.txt');
const defaultUnitTestArgs = ['-v', '-s', '.', '-p', '*test*.py'];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests re-discovery', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        await initialize();
    });
    setup(async function () {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(TEST_TIMEOUT * 2); // This hook requires more timeout as we're dealing with files as well
        await fs.copy(testFileWithFewTests, testFile, { overwrite: true });
        await deleteDirectory(path.join(testFilesPath, '.cache'));
        await resetSettings();
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        await ioc.dispose();
        await resetSettings();
        await fs.copy(testFileWithFewTests, testFile, { overwrite: true });
        await deleteFile(path.join(path.dirname(testFile), `${path.basename(testFile, '.py')}.pyc`));
    });

    async function resetSettings() {
        await updateSetting('testing.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
        await updateSetting('testing.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
    }

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        ioc.registerInterpreterStorageTypes();
        ioc.serviceManager.addSingletonInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService))
        );
    }

    async function discoverUnitTests(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(
            testProvider,
            rootWorkspaceUri!,
            testFilesPath
        );
        let tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        await deleteFile(path.join(path.dirname(testFile), `${path.basename(testFile, '.py')}.pyc`));
        await fs.copy(testFileWithMoreTests, testFile, { overwrite: true });
        tests = await testManager.discoverTests(CommandSource.ui, true, true);
        assert.equal(tests.testFunctions.length, 4, 'Incorrect number of updated test functions');
    }

    test('Re-discover tests (unittest)', async () => {
        await updateSetting('testing.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await discoverUnitTests('unittest');
    });

    test('Re-discover tests (pytest)', async () => {
        await updateSetting('testing.pytestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await discoverUnitTests('pytest');
    });

    test('Re-discover tests (nosetest)', async () => {
        await updateSetting('testing.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await discoverUnitTests('nosetest');
    });
});
