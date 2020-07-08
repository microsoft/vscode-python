// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as vscode from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { createPythonEnv } from '../../../client/common/process/pythonEnvironment';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { createPythonProcessService } from '../../../client/common/process/pythonProcess';
import {
    ExecutionFactoryCreateWithEnvironmentOptions,
    IBufferDecoder,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService
} from '../../../client/common/process/types';
import { IConfigurationService } from '../../../client/common/types';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { IServiceContainer } from '../../../client/ioc/types';
import { CondaService } from '../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { WindowsStoreInterpreter } from '../../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import { registerForIOC } from '../../../client/pythonEnvironments/legacyIOC';
import { CommandSource } from '../../../client/testing/common/constants';
import { ITestManagerFactory } from '../../../client/testing/common/types';
import { rootWorkspaceUri, updateSetting } from '../../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';
import { MockProcessService } from '../../mocks/proc';
import { UnitTestIocContainer } from '../serviceRegistry';

const UNITTEST_TEST_FILES_PATH = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'single'
);
const UNITTEST_TEST_FILES_PATH_WITH_CONFIGS = path.join(
    EXTENSION_ROOT_DIR,
    'src',
    'test',
    'pythonFiles',
    'testFiles',
    'unittestsWithConfigs'
);
const unitTestTestFilesCwdPath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src');

/*
These test results are from `/src/test/pythonFiles/testFiles/...` directories.
Run the command `python <ExtensionDir>/pythonFiles/testing_tools/run_adapter.py discover pytest -- -s --cache-clear` to get the JSON output.
*/

// tslint:disable:max-func-body-length
suite('Unit Tests - pytest - discovery with mocked process output', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST
        ? vscode.ConfigurationTarget.WorkspaceFolder
        : vscode.ConfigurationTarget.Workspace;
    @injectable()
    class ExecutionFactory extends PythonExecutionFactory {
        constructor(
            @inject(IServiceContainer) private readonly _serviceContainer: IServiceContainer,
            @inject(IEnvironmentActivationService) activationHelper: IEnvironmentActivationService,
            @inject(IProcessServiceFactory) processServiceFactory: IProcessServiceFactory,
            @inject(IConfigurationService) private readonly _configService: IConfigurationService,
            @inject(ICondaService) condaService: ICondaService,
            @inject(WindowsStoreInterpreter) windowsStoreInterpreter: WindowsStoreInterpreter,
            @inject(IBufferDecoder) decoder: IBufferDecoder,
            @inject(IPlatformService) platformService: IPlatformService
        ) {
            super(
                _serviceContainer,
                activationHelper,
                processServiceFactory,
                _configService,
                condaService,
                decoder,
                windowsStoreInterpreter,
                platformService
            );
        }
        public async createActivatedEnvironment(
            options: ExecutionFactoryCreateWithEnvironmentOptions
        ): Promise<IPythonExecutionService> {
            const pythonPath = options.interpreter
                ? options.interpreter.path
                : this._configService.getSettings(options.resource).pythonPath;
            const procService = (await ioc.serviceContainer
                .get<IProcessServiceFactory>(IProcessServiceFactory)
                .create()) as MockProcessService;
            const fileSystem = this._serviceContainer.get<IFileSystem>(IFileSystem);
            const env = createPythonEnv(pythonPath, procService, fileSystem);
            const procs = createPythonProcessService(procService, env);
            return {
                getInterpreterInformation: () => env.getInterpreterInformation(),
                getExecutablePath: () => env.getExecutablePath(),
                isModuleInstalled: (m) => env.isModuleInstalled(m),
                getExecutionInfo: (a) => env.getExecutionInfo(a),
                execObservable: (a, o) => procs.execObservable(a, o),
                execModuleObservable: (m, a, o) => procs.execModuleObservable(m, a, o),
                exec: (a, o) => procs.exec(a, o),
                execModule: (m, a, o) => procs.execModule(m, a, o)
            };
        }
    }
    suiteSetup(async () => {
        await initialize();
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        await ioc.dispose();
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();

        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.registerInterpreterStorageTypes();
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(
            IInterpreterService,
            instance(mock(InterpreterService))
        );
        ioc.serviceManager.rebind<IPythonExecutionFactory>(IPythonExecutionFactory, ExecutionFactory);
        registerForIOC(ioc.serviceManager);
        ioc.serviceManager.rebindInstance<ICondaService>(ICondaService, instance(mock(CondaService)));
    }

    async function injectTestDiscoveryOutput(output: string) {
        const procService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        procService.onExec((_file, args, _options, callback) => {
            if (args.indexOf('discover') >= 0 && args.indexOf('pytest') >= 0) {
                callback({
                    stdout: output
                });
            }
        });
    }

    test('Discover Tests (single test file)', async () => {
        await injectTestDiscoveryOutput(
            JSON.stringify([
                {
                    rootid: '.',
                    root:
                        '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/src/test/pythonFiles/testFiles/single',
                    parents: [
                        {
                            id: './test_root.py',
                            kind: 'file',
                            name: 'test_root.py',
                            relpath: './test_root.py',
                            parentid: '.'
                        },
                        {
                            id: './test_root.py::Test_Root_test1',
                            kind: 'suite',
                            name: 'Test_Root_test1',
                            parentid: './test_root.py'
                        },
                        {
                            id: './tests',
                            kind: 'folder',
                            name: 'tests',
                            relpath: './tests',
                            parentid: '.'
                        },
                        {
                            id: './tests/test_one.py',
                            kind: 'file',
                            name: 'test_one.py',
                            relpath: './tests/test_one.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_one.py::Test_test1',
                            kind: 'suite',
                            name: 'Test_test1',
                            parentid: './tests/test_one.py'
                        }
                    ],
                    tests: [
                        {
                            id: './test_root.py::Test_Root_test1::test_Root_A',
                            name: 'test_Root_A',
                            source: './test_root.py:6',
                            markers: [],
                            parentid: './test_root.py::Test_Root_test1'
                        },
                        {
                            id: './test_root.py::Test_Root_test1::test_Root_B',
                            name: 'test_Root_B',
                            source: './test_root.py:9',
                            markers: [],
                            parentid: './test_root.py::Test_Root_test1'
                        },
                        {
                            id: './test_root.py::Test_Root_test1::test_Root_c',
                            name: 'test_Root_c',
                            source: './test_root.py:12',
                            markers: [],
                            parentid: './test_root.py::Test_Root_test1'
                        },
                        {
                            id: './tests/test_one.py::Test_test1::test_A',
                            name: 'test_A',
                            source: 'tests/test_one.py:6',
                            markers: [],
                            parentid: './tests/test_one.py::Test_test1'
                        },
                        {
                            id: './tests/test_one.py::Test_test1::test_B',
                            name: 'test_B',
                            source: 'tests/test_one.py:9',
                            markers: [],
                            parentid: './tests/test_one.py::Test_test1'
                        },
                        {
                            id: './tests/test_one.py::Test_test1::test_c',
                            name: 'test_c',
                            source: 'tests/test_one.py:12',
                            markers: [],
                            parentid: './tests/test_one.py::Test_test1'
                        }
                    ]
                }
            ])
        );
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach((uri) => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_one.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_root.py'),
            true,
            'Test File not found'
        );
    });

    test('Discover Tests (pattern = test_)', async () => {
        await injectTestDiscoveryOutput(
            JSON.stringify([
                {
                    rootid: '.',
                    root:
                        '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/src/test/pythonFiles/testFiles/standard',
                    parents: [
                        {
                            id: './test_root.py',
                            relpath: './test_root.py',
                            kind: 'file',
                            name: 'test_root.py',
                            parentid: '.'
                        },
                        {
                            id: './test_root.py::Test_Root_test1',
                            kind: 'suite',
                            name: 'Test_Root_test1',
                            parentid: './test_root.py'
                        },
                        {
                            id: './tests',
                            relpath: './tests',
                            kind: 'folder',
                            name: 'tests',
                            parentid: '.'
                        },
                        {
                            id: './tests/test_another_pytest.py',
                            relpath: './tests/test_another_pytest.py',
                            kind: 'file',
                            name: 'test_another_pytest.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_another_pytest.py::test_parametrized_username',
                            kind: 'function',
                            name: 'test_parametrized_username',
                            parentid: './tests/test_another_pytest.py'
                        },
                        {
                            id: './tests/test_foreign_nested_tests.py',
                            relpath: './tests/test_foreign_nested_tests.py',
                            kind: 'file',
                            name: 'test_foreign_nested_tests.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_foreign_nested_tests.py::TestNestedForeignTests',
                            kind: 'suite',
                            name: 'TestNestedForeignTests',
                            parentid: './tests/test_foreign_nested_tests.py'
                        },
                        {
                            id: './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere',
                            kind: 'suite',
                            name: 'TestInheritingHere',
                            parentid: './tests/test_foreign_nested_tests.py::TestNestedForeignTests'
                        },
                        {
                            id:
                                './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere::TestExtraNestedForeignTests',
                            kind: 'suite',
                            name: 'TestExtraNestedForeignTests',
                            parentid: './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere'
                        },
                        {
                            id: './tests/test_pytest.py',
                            relpath: './tests/test_pytest.py',
                            kind: 'file',
                            name: 'test_pytest.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp',
                            kind: 'suite',
                            name: 'Test_CheckMyApp',
                            parentid: './tests/test_pytest.py'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA',
                            kind: 'suite',
                            name: 'Test_NestedClassA',
                            parentid: './tests/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::Test_nested_classB_Of_A',
                            kind: 'suite',
                            name: 'Test_nested_classB_Of_A',
                            parentid: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA'
                        },
                        {
                            id: './tests/test_pytest.py::test_parametrized_username',
                            kind: 'function',
                            name: 'test_parametrized_username',
                            parentid: './tests/test_pytest.py'
                        },
                        {
                            id: './tests/test_unittest_one.py',
                            relpath: './tests/test_unittest_one.py',
                            kind: 'file',
                            name: 'test_unittest_one.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_unittest_one.py::Test_test1',
                            kind: 'suite',
                            name: 'Test_test1',
                            parentid: './tests/test_unittest_one.py'
                        },
                        {
                            id: './tests/test_unittest_two.py',
                            relpath: './tests/test_unittest_two.py',
                            kind: 'file',
                            name: 'test_unittest_two.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2',
                            kind: 'suite',
                            name: 'Test_test2',
                            parentid: './tests/test_unittest_two.py'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2a',
                            kind: 'suite',
                            name: 'Test_test2a',
                            parentid: './tests/test_unittest_two.py'
                        },
                        {
                            id: './tests/unittest_three_test.py',
                            relpath: './tests/unittest_three_test.py',
                            kind: 'file',
                            name: 'unittest_three_test.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/unittest_three_test.py::Test_test3',
                            kind: 'suite',
                            name: 'Test_test3',
                            parentid: './tests/unittest_three_test.py'
                        }
                    ],
                    tests: [
                        {
                            id: './test_root.py::Test_Root_test1::test_Root_A',
                            name: 'test_Root_A',
                            source: './test_root.py:6',
                            markers: [],
                            parentid: './test_root.py::Test_Root_test1'
                        },
                        {
                            id: './test_root.py::Test_Root_test1::test_Root_B',
                            name: 'test_Root_B',
                            source: './test_root.py:9',
                            markers: [],
                            parentid: './test_root.py::Test_Root_test1'
                        },
                        {
                            id: './test_root.py::Test_Root_test1::test_Root_c',
                            name: 'test_Root_c',
                            source: './test_root.py:12',
                            markers: [],
                            parentid: './test_root.py::Test_Root_test1'
                        },
                        {
                            id: './tests/test_another_pytest.py::test_username',
                            name: 'test_username',
                            source: 'tests/test_another_pytest.py:12',
                            markers: [],
                            parentid: './tests/test_another_pytest.py'
                        },
                        {
                            id: './tests/test_another_pytest.py::test_parametrized_username[one]',
                            name: 'test_parametrized_username[one]',
                            source: 'tests/test_another_pytest.py:15',
                            markers: [],
                            parentid: './tests/test_another_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './tests/test_another_pytest.py::test_parametrized_username[two]',
                            name: 'test_parametrized_username[two]',
                            source: 'tests/test_another_pytest.py:15',
                            markers: [],
                            parentid: './tests/test_another_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './tests/test_another_pytest.py::test_parametrized_username[three]',
                            name: 'test_parametrized_username[three]',
                            source: 'tests/test_another_pytest.py:15',
                            markers: [],
                            parentid: './tests/test_another_pytest.py::test_parametrized_username'
                        },
                        {
                            id:
                                './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere::TestExtraNestedForeignTests::test_super_deep_foreign',
                            name: 'test_super_deep_foreign',
                            source: 'tests/external.py:2',
                            markers: [],
                            parentid:
                                './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere::TestExtraNestedForeignTests'
                        },
                        {
                            id:
                                './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere::test_foreign_test',
                            name: 'test_foreign_test',
                            source: 'tests/external.py:4',
                            markers: [],
                            parentid: './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere'
                        },
                        {
                            id:
                                './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere::test_nested_normal',
                            name: 'test_nested_normal',
                            source: 'tests/test_foreign_nested_tests.py:5',
                            markers: [],
                            parentid: './tests/test_foreign_nested_tests.py::TestNestedForeignTests::TestInheritingHere'
                        },
                        {
                            id: './tests/test_foreign_nested_tests.py::TestNestedForeignTests::test_normal',
                            name: 'test_normal',
                            source: 'tests/test_foreign_nested_tests.py:7',
                            markers: [],
                            parentid: './tests/test_foreign_nested_tests.py::TestNestedForeignTests'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::test_simple_check',
                            name: 'test_simple_check',
                            source: 'tests/test_pytest.py:6',
                            markers: [],
                            parentid: './tests/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::test_complex_check',
                            name: 'test_complex_check',
                            source: 'tests/test_pytest.py:9',
                            markers: [],
                            parentid: './tests/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::test_nested_class_methodB',
                            name: 'test_nested_class_methodB',
                            source: 'tests/test_pytest.py:13',
                            markers: [],
                            parentid: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA'
                        },
                        {
                            id:
                                './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::Test_nested_classB_Of_A::test_d',
                            name: 'test_d',
                            source: 'tests/test_pytest.py:16',
                            markers: [],
                            parentid:
                                './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::Test_nested_classB_Of_A'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::test_nested_class_methodC',
                            name: 'test_nested_class_methodC',
                            source: 'tests/test_pytest.py:18',
                            markers: [],
                            parentid: './tests/test_pytest.py::Test_CheckMyApp::Test_NestedClassA'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::test_simple_check2',
                            name: 'test_simple_check2',
                            source: 'tests/test_pytest.py:21',
                            markers: [],
                            parentid: './tests/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './tests/test_pytest.py::Test_CheckMyApp::test_complex_check2',
                            name: 'test_complex_check2',
                            source: 'tests/test_pytest.py:23',
                            markers: [],
                            parentid: './tests/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './tests/test_pytest.py::test_username',
                            name: 'test_username',
                            source: 'tests/test_pytest.py:35',
                            markers: [],
                            parentid: './tests/test_pytest.py'
                        },
                        {
                            id: './tests/test_pytest.py::test_parametrized_username[one]',
                            name: 'test_parametrized_username[one]',
                            source: 'tests/test_pytest.py:38',
                            markers: [],
                            parentid: './tests/test_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './tests/test_pytest.py::test_parametrized_username[two]',
                            name: 'test_parametrized_username[two]',
                            source: 'tests/test_pytest.py:38',
                            markers: [],
                            parentid: './tests/test_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './tests/test_pytest.py::test_parametrized_username[three]',
                            name: 'test_parametrized_username[three]',
                            source: 'tests/test_pytest.py:38',
                            markers: [],
                            parentid: './tests/test_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './tests/test_unittest_one.py::Test_test1::test_A',
                            name: 'test_A',
                            source: 'tests/test_unittest_one.py:6',
                            markers: [],
                            parentid: './tests/test_unittest_one.py::Test_test1'
                        },
                        {
                            id: './tests/test_unittest_one.py::Test_test1::test_B',
                            name: 'test_B',
                            source: 'tests/test_unittest_one.py:9',
                            markers: [],
                            parentid: './tests/test_unittest_one.py::Test_test1'
                        },
                        {
                            id: './tests/test_unittest_one.py::Test_test1::test_c',
                            name: 'test_c',
                            source: 'tests/test_unittest_one.py:12',
                            markers: [],
                            parentid: './tests/test_unittest_one.py::Test_test1'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2::test_A2',
                            name: 'test_A2',
                            source: 'tests/test_unittest_two.py:3',
                            markers: [],
                            parentid: './tests/test_unittest_two.py::Test_test2'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2::test_B2',
                            name: 'test_B2',
                            source: 'tests/test_unittest_two.py:6',
                            markers: [],
                            parentid: './tests/test_unittest_two.py::Test_test2'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2::test_C2',
                            name: 'test_C2',
                            source: 'tests/test_unittest_two.py:9',
                            markers: [],
                            parentid: './tests/test_unittest_two.py::Test_test2'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2::test_D2',
                            name: 'test_D2',
                            source: 'tests/test_unittest_two.py:12',
                            markers: [],
                            parentid: './tests/test_unittest_two.py::Test_test2'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2a::test_222A2',
                            name: 'test_222A2',
                            source: 'tests/test_unittest_two.py:17',
                            markers: [],
                            parentid: './tests/test_unittest_two.py::Test_test2a'
                        },
                        {
                            id: './tests/test_unittest_two.py::Test_test2a::test_222B2',
                            name: 'test_222B2',
                            source: 'tests/test_unittest_two.py:20',
                            markers: [],
                            parentid: './tests/test_unittest_two.py::Test_test2a'
                        },
                        {
                            id: './tests/unittest_three_test.py::Test_test3::test_A',
                            name: 'test_A',
                            source: 'tests/unittest_three_test.py:4',
                            markers: [],
                            parentid: './tests/unittest_three_test.py::Test_test3'
                        },
                        {
                            id: './tests/unittest_three_test.py::Test_test3::test_B',
                            name: 'test_B',
                            source: 'tests/unittest_three_test.py:7',
                            markers: [],
                            parentid: './tests/unittest_three_test.py::Test_test3'
                        }
                    ]
                }
            ])
        );
        await updateSetting('testing.pytestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach((uri) => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 7, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 33, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 11, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_foreign_nested_tests.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_unittest_one.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_unittest_two.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'unittest_three_test.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_pytest.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_another_pytest.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_root.py'),
            true,
            'Test File not found'
        );
    });

    test('Discover Tests (pattern = _test)', async () => {
        await injectTestDiscoveryOutput(
            JSON.stringify([
                {
                    rootid: '.',
                    root:
                        '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/src/test/pythonFiles/testFiles/standard',
                    parents: [
                        {
                            id: './tests',
                            kind: 'folder',
                            name: 'tests',
                            relpath: './tests',
                            parentid: '.'
                        },
                        {
                            id: './tests/unittest_three_test.py',
                            kind: 'file',
                            name: 'unittest_three_test.py',
                            relpath: './tests/unittest_three_test.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/unittest_three_test.py::Test_test3',
                            kind: 'suite',
                            name: 'Test_test3',
                            parentid: './tests/unittest_three_test.py'
                        }
                    ],
                    tests: [
                        {
                            id: './tests/unittest_three_test.py::Test_test3::test_A',
                            name: 'test_A',
                            source: 'tests/unittest_three_test.py:4',
                            markers: [],
                            parentid: './tests/unittest_three_test.py::Test_test3'
                        },
                        {
                            id: './tests/unittest_three_test.py::Test_test3::test_B',
                            name: 'test_B',
                            source: 'tests/unittest_three_test.py:7',
                            markers: [],
                            parentid: './tests/unittest_three_test.py::Test_test3'
                        }
                    ]
                }
            ])
        );
        await updateSetting('testing.pytestArgs', ['-k=_test.py'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach((uri) => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'unittest_three_test.py'),
            true,
            'Test File not found'
        );
    });

    test('Discover Tests (with config)', async () => {
        await injectTestDiscoveryOutput(
            JSON.stringify([
                {
                    rootid: '.',
                    root:
                        '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/src/test/pythonFiles/testFiles/unittestsWithConfigs',
                    parents: [
                        {
                            id: './other',
                            relpath: './other',
                            kind: 'folder',
                            name: 'other',
                            parentid: '.'
                        },
                        {
                            id: './other/test_pytest.py',
                            relpath: './other/test_pytest.py',
                            kind: 'file',
                            name: 'test_pytest.py',
                            parentid: './other'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp',
                            kind: 'suite',
                            name: 'Test_CheckMyApp',
                            parentid: './other/test_pytest.py'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA',
                            kind: 'suite',
                            name: 'Test_NestedClassA',
                            parentid: './other/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::Test_nested_classB_Of_A',
                            kind: 'suite',
                            name: 'Test_nested_classB_Of_A',
                            parentid: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA'
                        },
                        {
                            id: './other/test_pytest.py::test_parametrized_username',
                            kind: 'function',
                            name: 'test_parametrized_username',
                            parentid: './other/test_pytest.py'
                        },
                        {
                            id: './other/test_unittest_one.py',
                            relpath: './other/test_unittest_one.py',
                            kind: 'file',
                            name: 'test_unittest_one.py',
                            parentid: './other'
                        },
                        {
                            id: './other/test_unittest_one.py::Test_test1',
                            kind: 'suite',
                            name: 'Test_test1',
                            parentid: './other/test_unittest_one.py'
                        }
                    ],
                    tests: [
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::test_simple_check',
                            name: 'test_simple_check',
                            source: 'other/test_pytest.py:6',
                            markers: [],
                            parentid: './other/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::test_complex_check',
                            name: 'test_complex_check',
                            source: 'other/test_pytest.py:9',
                            markers: [],
                            parentid: './other/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::test_nested_class_methodB',
                            name: 'test_nested_class_methodB',
                            source: 'other/test_pytest.py:13',
                            markers: [],
                            parentid: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA'
                        },
                        {
                            id:
                                './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::Test_nested_classB_Of_A::test_d',
                            name: 'test_d',
                            source: 'other/test_pytest.py:16',
                            markers: [],
                            parentid:
                                './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::Test_nested_classB_Of_A'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA::test_nested_class_methodC',
                            name: 'test_nested_class_methodC',
                            source: 'other/test_pytest.py:18',
                            markers: [],
                            parentid: './other/test_pytest.py::Test_CheckMyApp::Test_NestedClassA'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::test_simple_check2',
                            name: 'test_simple_check2',
                            source: 'other/test_pytest.py:21',
                            markers: [],
                            parentid: './other/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './other/test_pytest.py::Test_CheckMyApp::test_complex_check2',
                            name: 'test_complex_check2',
                            source: 'other/test_pytest.py:23',
                            markers: [],
                            parentid: './other/test_pytest.py::Test_CheckMyApp'
                        },
                        {
                            id: './other/test_pytest.py::test_username',
                            name: 'test_username',
                            source: 'other/test_pytest.py:35',
                            markers: [],
                            parentid: './other/test_pytest.py'
                        },
                        {
                            id: './other/test_pytest.py::test_parametrized_username[one]',
                            name: 'test_parametrized_username[one]',
                            source: 'other/test_pytest.py:38',
                            markers: [],
                            parentid: './other/test_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './other/test_pytest.py::test_parametrized_username[two]',
                            name: 'test_parametrized_username[two]',
                            source: 'other/test_pytest.py:38',
                            markers: [],
                            parentid: './other/test_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './other/test_pytest.py::test_parametrized_username[three]',
                            name: 'test_parametrized_username[three]',
                            source: 'other/test_pytest.py:38',
                            markers: [],
                            parentid: './other/test_pytest.py::test_parametrized_username'
                        },
                        {
                            id: './other/test_unittest_one.py::Test_test1::test_A',
                            name: 'test_A',
                            source: 'other/test_unittest_one.py:6',
                            markers: [],
                            parentid: './other/test_unittest_one.py::Test_test1'
                        },
                        {
                            id: './other/test_unittest_one.py::Test_test1::test_B',
                            name: 'test_B',
                            source: 'other/test_unittest_one.py:9',
                            markers: [],
                            parentid: './other/test_unittest_one.py::Test_test1'
                        },
                        {
                            id: './other/test_unittest_one.py::Test_test1::test_c',
                            name: 'test_c',
                            source: 'other/test_unittest_one.py:12',
                            markers: [],
                            parentid: './other/test_unittest_one.py::Test_test1'
                        }
                    ]
                }
            ])
        );
        await updateSetting('testing.pytestArgs', [], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, UNITTEST_TEST_FILES_PATH_WITH_CONFIGS);
        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach((uri) => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 14, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 4, 'Incorrect number of test suites');
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_unittest_one.py'),
            true,
            'Test File not found'
        );
        assert.equal(
            tests.testFiles.some((t) => t.name === 'test_pytest.py'),
            true,
            'Test File not found'
        );
    });

    test('Setting cwd should return tests', async () => {
        await injectTestDiscoveryOutput(
            JSON.stringify([
                {
                    rootid: '.',
                    root:
                        '/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/src/test/pythonFiles/testFiles/cwd/src',
                    parents: [
                        {
                            id: './tests',
                            kind: 'folder',
                            name: 'tests',
                            relpath: './tests',
                            parentid: '.'
                        },
                        {
                            id: './tests/test_cwd.py',
                            kind: 'file',
                            name: 'test_cwd.py',
                            relpath: './tests/test_cwd.py',
                            parentid: './tests'
                        },
                        {
                            id: './tests/test_cwd.py::Test_Current_Working_Directory',
                            kind: 'suite',
                            name: 'Test_Current_Working_Directory',
                            parentid: './tests/test_cwd.py'
                        }
                    ],
                    tests: [
                        {
                            id: './tests/test_cwd.py::Test_Current_Working_Directory::test_cwd',
                            name: 'test_cwd',
                            source: 'tests/test_cwd.py:6',
                            markers: [],
                            parentid: './tests/test_cwd.py::Test_Current_Working_Directory'
                        }
                    ]
                }
            ])
        );
        await updateSetting('testing.pytestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
        const testManager = factory('pytest', rootWorkspaceUri!, unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(CommandSource.ui, true, true);
        const diagnosticCollectionUris: vscode.Uri[] = [];
        testManager.diagnosticCollection.forEach((uri) => {
            diagnosticCollectionUris.push(uri);
        });
        assert.equal(diagnosticCollectionUris.length, 0, 'Should not have diagnostics yet');
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 2, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    });
});
