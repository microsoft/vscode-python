// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as fs from 'fs-extra';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import { CancellationTokenSource, DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IInvalidPythonPathInDebuggerService } from '../../../client/application/diagnostics/types';
import { IApplicationShell, IDebugService } from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import '../../../client/common/extensions';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { DebuggerTypeName } from '../../../client/debugger/constants';
import { IDebugEnvironmentVariablesService } from '../../../client/debugger/extension/configuration/resolvers/helper';
import { LaunchConfigurationResolver } from '../../../client/debugger/extension/configuration/resolvers/launch';
import { DebugOptions } from '../../../client/debugger/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { DebugLauncher } from '../../../client/testing/common/debugLauncher';
import { LaunchOptions } from '../../../client/testing/common/types';
import { ITestingSettings } from '../../../client/testing/configuration/types';
import { TestProvider } from '../../../client/testing/types';
import { isOs, OSType } from '../../common';

use(chaiAsPromised);

suite('Unit Tests - Debug Launcher', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let unitTestSettings: TypeMoq.IMock<ITestingSettings>;
    let debugLauncher: DebugLauncher;
    let debugService: TypeMoq.IMock<IDebugService>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let debugEnvHelper: TypeMoq.IMock<IDebugEnvironmentVariablesService>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let getWorkspaceFolderStub: sinon.SinonStub;
    let getWorkspaceFoldersStub: sinon.SinonStub;
    let pathExistsStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;

    setup(async () => {
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        const configService = TypeMoq.Mock.ofType<IConfigurationService>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);

        debugService = TypeMoq.Mock.ofType<IDebugService>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IDebugService))).returns(() => debugService.object);
        getWorkspaceFolderStub = sinon.stub(workspaceApis, 'getWorkspaceFolder');
        getWorkspaceFoldersStub = sinon.stub(workspaceApis, 'getWorkspaceFolders');
        pathExistsStub = sinon.stub(fs, 'pathExists');
        readFileStub = sinon.stub(fs, 'readFile');

        const appShell = TypeMoq.Mock.ofType<IApplicationShell>(undefined, TypeMoq.MockBehavior.Strict);
        appShell.setup((a) => a.showErrorMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);

        settings = TypeMoq.Mock.ofType<IPythonSettings>(undefined, TypeMoq.MockBehavior.Strict);
        configService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

        unitTestSettings = TypeMoq.Mock.ofType<ITestingSettings>(undefined, TypeMoq.MockBehavior.Strict);
        settings.setup((p) => p.testing).returns(() => unitTestSettings.object);

        debugEnvHelper = TypeMoq.Mock.ofType<IDebugEnvironmentVariablesService>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IDebugEnvironmentVariablesService)))
            .returns(() => debugEnvHelper.object);

        debugLauncher = new DebugLauncher(serviceContainer.object, getNewResolver(configService.object));
    });

    teardown(() => {
        sinon.restore();
    });

    function getNewResolver(configService: IConfigurationService) {
        const validator = TypeMoq.Mock.ofType<IInvalidPythonPathInDebuggerService>(
            undefined,
            TypeMoq.MockBehavior.Strict,
        );
        validator
            .setup((v) => v.validatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true));
        return new LaunchConfigurationResolver(
            validator.object,
            configService,
            debugEnvHelper.object,
            interpreterService.object,
        );
    }
    function setupDebugManager(
        workspaceFolder: WorkspaceFolder,
        expected: DebugConfiguration,
        testProvider: TestProvider,
    ) {
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(({ path: 'python' } as unknown) as PythonEnvironment));
        settings.setup((p) => p.envFile).returns(() => __filename);
        const args = expected.args;
        const debugArgs = testProvider === 'unittest' ? args.filter((item: string) => item !== '--debug') : args;
        expected.args = debugArgs;

        debugEnvHelper
            .setup((d) => d.getEnvironmentVariables(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(expected.env));

        debugService
            .setup((d) => d.startDebugging(TypeMoq.It.isValue(workspaceFolder), TypeMoq.It.isValue(expected)))
            .returns((_wspc: WorkspaceFolder, _expectedParam: DebugConfiguration) => {
                return Promise.resolve(undefined as any);
            })
            .verifiable(TypeMoq.Times.once());

        debugService
            .setup((d) => d.onDidTerminateDebugSession(TypeMoq.It.isAny()))
            .returns((callback) => {
                callback();
                return undefined as any;
            })
            .verifiable(TypeMoq.Times.once());
    }
    function createWorkspaceFolder(folderPath: string): WorkspaceFolder {
        return {
            index: 0,
            name: path.basename(folderPath),
            uri: Uri.file(folderPath),
        };
    }
    function getTestLauncherScript(testProvider: TestProvider) {
        switch (testProvider) {
            case 'unittest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'visualstudio_py_testlauncher.py');
            }
            case 'pytest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'testlauncher.py');
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
    function getDefaultDebugConfig(): DebugConfiguration {
        return {
            name: 'Debug Unit Test',
            type: DebuggerTypeName,
            request: 'launch',
            console: 'internalConsole',
            env: {},
            envFile: __filename,
            stopOnEntry: false,
            showReturnValue: true,
            redirectOutput: true,
            debugStdLib: false,
            subProcess: true,
            purpose: [],
        };
    }
    function setupSuccess(
        options: LaunchOptions,
        testProvider: TestProvider,
        expected?: DebugConfiguration,
        debugConfigs?: string | DebugConfiguration[],
    ) {
        const testLaunchScript = getTestLauncherScript(testProvider);

        const workspaceFolders = [createWorkspaceFolder(options.cwd), createWorkspaceFolder('five/six/seven')];
        getWorkspaceFoldersStub.returns(workspaceFolders);
        getWorkspaceFolderStub.returns(workspaceFolders[0]);

        if (!debugConfigs) {
            pathExistsStub.resolves(false);
        } else {
            pathExistsStub.resolves(true);

            if (typeof debugConfigs !== 'string') {
                debugConfigs = JSON.stringify({
                    version: '0.1.0',
                    configurations: debugConfigs,
                });
            }
            readFileStub.resolves(debugConfigs as string);
        }

        if (!expected) {
            expected = getDefaultDebugConfig();
        }
        expected.rules = [{ path: path.join(EXTENSION_ROOT_DIR, 'pythonFiles'), include: false }];
        expected.program = testLaunchScript;
        expected.args = options.args;

        if (!expected.cwd) {
            expected.cwd = workspaceFolders[0].uri.fsPath;
        }

        // added by LaunchConfigurationResolver:
        if (!expected.python) {
            expected.python = 'python';
        }
        if (!expected.clientOS) {
            expected.clientOS = isOs(OSType.Windows) ? 'windows' : 'unix';
        }
        if (!expected.debugAdapterPython) {
            expected.debugAdapterPython = 'python';
        }
        if (!expected.debugLauncherPython) {
            expected.debugLauncherPython = 'python';
        }
        expected.workspaceFolder = workspaceFolders[0].uri.fsPath;
        expected.debugOptions = [];
        if (expected.justMyCode === undefined) {
            // Populate justMyCode using debugStdLib
            expected.justMyCode = !expected.debugStdLib;
        }
        if (!expected.justMyCode) {
            expected.debugOptions.push(DebugOptions.DebugStdLib);
        }
        if (expected.stopOnEntry) {
            expected.debugOptions.push(DebugOptions.StopOnEntry);
        }
        if (expected.showReturnValue) {
            expected.debugOptions.push(DebugOptions.ShowReturnValue);
        }
        if (expected.redirectOutput) {
            expected.debugOptions.push(DebugOptions.RedirectOutput);
        }
        if (expected.subProcess) {
            expected.debugOptions.push(DebugOptions.SubProcess);
        }
        if (isOs(OSType.Windows)) {
            expected.debugOptions.push(DebugOptions.FixFilePathCase);
        }

        setupDebugManager(workspaceFolders[0], expected, testProvider);
    }

    const testProviders: TestProvider[] = ['pytest', 'unittest'];

    testProviders.forEach((testProvider) => {
        const testTitleSuffix = `(Test Framework '${testProvider}')`;

        test(`Must launch debugger ${testTitleSuffix}`, async () => {
            const options = {
                cwd: 'one/two/three',
                args: ['/one/two/three/testfile.py'],
                testProvider,
            };
            setupSuccess(options, testProvider);

            await debugLauncher.launchDebugger(options);

            debugService.verifyAll();
        });
        test(`Must launch debugger with arguments ${testTitleSuffix}`, async () => {
            const options = {
                cwd: 'one/two/three',
                args: ['/one/two/three/testfile.py', '--debug', '1'],
                testProvider,
            };
            setupSuccess(options, testProvider);

            await debugLauncher.launchDebugger(options);

            debugService.verifyAll();
        });
        test(`Must not launch debugger if cancelled ${testTitleSuffix}`, async () => {
            debugService
                .setup((d) => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve(undefined as any);
                })
                .verifiable(TypeMoq.Times.never());

            const cancellationToken = new CancellationTokenSource();
            cancellationToken.cancel();
            const token = cancellationToken.token;
            const options: LaunchOptions = { cwd: '', args: [], token, testProvider };

            await expect(debugLauncher.launchDebugger(options)).to.be.eventually.equal(undefined, 'not undefined');

            debugService.verifyAll();
        });
        test(`Must throw an exception if there are no workspaces ${testTitleSuffix}`, async () => {
            getWorkspaceFoldersStub.returns(undefined);
            debugService
                .setup((d) => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined as any))
                .verifiable(TypeMoq.Times.never());

            const options: LaunchOptions = { cwd: '', args: [], testProvider };

            await expect(debugLauncher.launchDebugger(options)).to.eventually.rejectedWith('Please open a workspace');

            debugService.verifyAll();
        });
    });

    test('Tries launch.json first', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        expected.name = 'spam';
        setupSuccess(options, 'unittest', expected, [{ name: 'spam', type: DebuggerTypeName, request: 'test' }]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Full debug config', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = {
            name: 'my tests',
            type: DebuggerTypeName,
            request: 'launch',
            python: 'some/dir/bin/py3',
            debugAdapterPython: 'some/dir/bin/py3',
            debugLauncherPython: 'some/dir/bin/py3',
            stopOnEntry: true,
            showReturnValue: true,
            console: 'integratedTerminal',
            cwd: 'some/dir',
            env: {
                SPAM: 'EGGS',
            },
            envFile: 'some/dir/.env',
            redirectOutput: false,
            debugStdLib: true,
            justMyCode: false,
            // added by LaunchConfigurationResolver:
            internalConsoleOptions: 'neverOpen',
            subProcess: true,
            purpose: [],
        };
        setupSuccess(options, 'unittest', expected, [
            {
                name: 'my tests',
                type: DebuggerTypeName,
                request: 'test',
                pythonPath: expected.python,
                stopOnEntry: expected.stopOnEntry,
                showReturnValue: expected.showReturnValue,
                console: expected.console,
                cwd: expected.cwd,
                env: expected.env,
                envFile: expected.envFile,
                redirectOutput: expected.redirectOutput,
                debugStdLib: expected.debugStdLib,
                justMyCode: undefined,
            },
        ]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Uses first entry', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        expected.name = 'spam1';
        setupSuccess(options, 'unittest', expected, [
            { name: 'spam1', type: DebuggerTypeName, request: 'test' },
            { name: 'spam2', type: DebuggerTypeName, request: 'test' },
            { name: 'spam3', type: DebuggerTypeName, request: 'test' },
        ]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Handles bad JSON', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        setupSuccess(options, 'unittest', expected, ']');

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    const malformedFiles = [
        '// test 1',
        '// test 2 \n\
    { \n\
        "name": "spam", \n\
        "type": "python", \n\
        "request": "test" \n\
    } \n\
            ',
        '// test 3 \n\
    [ \n\
        { \n\
            "name": "spam", \n\
            "type": "python", \n\
            "request": "test" \n\
        } \n\
    ] \n\
            ',
        '// test 4 \n\
    { \n\
        "configurations": [ \n\
            { \n\
                "name": "spam", \n\
                "type": "python", \n\
                "request": "test" \n\
            } \n\
        ] \n\
    } \n\
            ',
    ];
    for (const text of malformedFiles) {
        const testID = text.split('\n')[0].substring(3).trim();
        test(`Handles malformed launch.json - ${testID}`, async () => {
            const options: LaunchOptions = {
                cwd: 'one/two/three',
                args: ['/one/two/three/testfile.py'],
                testProvider: 'unittest',
            };
            const expected = getDefaultDebugConfig();
            setupSuccess(options, 'unittest', expected, text);

            await debugLauncher.launchDebugger(options);

            debugService.verifyAll();
        });
    }

    test('Handles bad debug config items', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();

        setupSuccess(options, 'unittest', expected, [
            {} as DebugConfiguration,
            { name: 'spam1' } as DebugConfiguration,
            { name: 'spam2', type: DebuggerTypeName } as DebugConfiguration,
            { name: 'spam3', request: 'test' } as DebugConfiguration,
            { type: DebuggerTypeName } as DebugConfiguration,
            { type: DebuggerTypeName, request: 'test' } as DebugConfiguration,
            { request: 'test' } as DebugConfiguration,
        ]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Handles non-python debug configs', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        setupSuccess(options, 'unittest', expected, [{ name: 'foo', type: 'other', request: 'bar' }]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Handles bogus python debug configs', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        setupSuccess(options, 'unittest', expected, [{ name: 'spam', type: DebuggerTypeName, request: 'bogus' }]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Handles non-test debug config', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        setupSuccess(options, 'unittest', expected, [
            { name: 'spam', type: DebuggerTypeName, request: 'launch' },
            { name: 'spam', type: DebuggerTypeName, request: 'attach' },
        ]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Handles mixed debug config', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        expected.name = 'spam2';
        setupSuccess(options, 'unittest', expected, [
            { name: 'foo1', type: 'other', request: 'bar' },
            { name: 'foo2', type: 'other', request: 'bar' },
            { name: 'spam1', type: DebuggerTypeName, request: 'launch' },
            { name: 'spam2', type: DebuggerTypeName, request: 'test' },
            { name: 'spam3', type: DebuggerTypeName, request: 'attach' },
            { name: 'xyz', type: 'another', request: 'abc' },
        ]);

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });

    test('Handles comments', async () => {
        const options: LaunchOptions = {
            cwd: 'one/two/three',
            args: ['/one/two/three/testfile.py'],
            testProvider: 'unittest',
        };
        const expected = getDefaultDebugConfig();
        expected.name = 'spam';
        expected.stopOnEntry = true;
        setupSuccess(
            options,
            'unittest',
            expected,
            ' \n\
    { \n\
        "version": "0.1.0", \n\
        "configurations": [ \n\
            // my thing \n\
            { \n\
                // "test" debug config \n\
                "name": "spam",  /* non-empty */ \n\
                "type": "python",  /* must be "python" */ \n\
                "request": "test",  /* must be "test" */ \n\
                // extra stuff here: \n\
                "stopOnEntry": true \n\
            } \n\
        ] \n\
    } \n\
            ',
        );

        await debugLauncher.launchDebugger(options);

        debugService.verifyAll();
    });
    test('Ensure trailing commands in JSON are handled', async () => {
        const workspaceFolder = { name: 'abc', index: 0, uri: Uri.file(__filename) };
        const filename = path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
        const jsonc = '{"version":"1234", "configurations":[1,2,],}';
        pathExistsStub.resolves(true);
        readFileStub.withArgs(filename).resolves(jsonc);

        const configs = await debugLauncher.readAllDebugConfigs(workspaceFolder);

        expect(configs).to.be.deep.equal([1, 2]);
    });
    test('Ensure empty configuration is returned when launch.json cannot be parsed', async () => {
        const workspaceFolder = { name: 'abc', index: 0, uri: Uri.file(__filename) };
        const filename = path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
        const jsonc = '{"version":"1234"';

        pathExistsStub.resolves(true);
        readFileStub.withArgs(filename).resolves(jsonc);

        const configs = await debugLauncher.readAllDebugConfigs(workspaceFolder);

        expect(configs).to.be.deep.equal([]);
    });
});
