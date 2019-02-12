// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import {
    CancellationTokenSource, DebugConfiguration, Uri, WorkspaceFolder
} from 'vscode';
import { IDebugService, IWorkspaceService } from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import '../../../client/common/extensions';
import { IConfigurationService, IPythonSettings, IUnitTestSettings } from '../../../client/common/types';
import { DebuggerTypeName } from '../../../client/debugger/constants';
import { IDebugConfigurationResolver } from '../../../client/debugger/extension/configuration/types';
import {
    DebugOptions, LaunchRequestArguments
} from '../../../client/debugger/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { DebugLauncher } from '../../../client/unittests/common/debugLauncher';
import { LaunchOptions, TestProvider } from '../../../client/unittests/common/types';

use(chaiAsPromised);

// tslint:disable-next-line:max-func-body-length no-any
suite('Unit Tests - Debug Launcher', () => {
    let unitTestSettings: TypeMoq.IMock<IUnitTestSettings>;
    let debugLauncher: DebugLauncher;
    let debugService: TypeMoq.IMock<IDebugService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let resolver: TypeMoq.IMock<IDebugConfigurationResolver<LaunchRequestArguments>>;
    let hasWorkspaceFolders: boolean;
    setup(async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        const configService = TypeMoq.Mock.ofType<IConfigurationService>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);

        debugService = TypeMoq.Mock.ofType<IDebugService>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDebugService))).returns(() => debugService.object);

        hasWorkspaceFolders = true;
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceService.setup(u => u.hasWorkspaceFolders)
            .returns(() => hasWorkspaceFolders);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);

        settings = TypeMoq.Mock.ofType<IPythonSettings>(undefined, TypeMoq.MockBehavior.Strict);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

        unitTestSettings = TypeMoq.Mock.ofType<IUnitTestSettings>(undefined, TypeMoq.MockBehavior.Strict);
        settings.setup(p => p.unitTest).returns(() => unitTestSettings.object);

        resolver = TypeMoq.Mock.ofType<IDebugConfigurationResolver<LaunchRequestArguments>>();

        debugLauncher = new DebugLauncher(serviceContainer.object, resolver.object);
    });
    function setupDebugManager(
        workspaceFolder: WorkspaceFolder,
        debugConfig: DebugConfiguration,
        testProvider: TestProvider
    ) {
        const envFile = __filename;
        settings.setup(p => p.envFile).returns(() => envFile);
        const args = debugConfig.args;
        const debugArgs = testProvider === 'unittest' ? args.filter(item => item !== '--debug') : args;
        debugConfig.envFile = envFile;
        debugConfig.args = debugArgs;

        debugService.setup(d => d.startDebugging(TypeMoq.It.isValue(workspaceFolder), TypeMoq.It.isObjectWith(debugConfig)))
            .returns(() => Promise.resolve(undefined as any))
            .verifiable(TypeMoq.Times.once());
    }
    function createWorkspaceFolder(folderPath: string): WorkspaceFolder {
        return {
            index: 0,
            name: path.basename(folderPath),
            uri: Uri.file(folderPath)
        };
    }
    function getTestLauncherScript(testProvider: TestProvider) {
        switch (testProvider) {
            case 'unittest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'visualstudio_py_testlauncher.py');
            }
            case 'pytest':
            case 'nosetest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'testlauncher.py');
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
    const testProviders: TestProvider[] = ['nosetest', 'pytest', 'unittest'];
    testProviders.forEach(testProvider => {
        const testTitleSuffix = `(Test Framework '${testProvider}')`;
        const testLaunchScript = getTestLauncherScript(testProvider);
        const debuggerType = DebuggerTypeName;

        function setupSuccess(options: LaunchOptions) {
            const workspaceFolders = [
                createWorkspaceFolder(options.cwd),
                createWorkspaceFolder('five/six/seven')
            ];
            workspaceService.setup(u => u.workspaceFolders)
                .returns(() => workspaceFolders);
            workspaceService.setup(u => u.getWorkspaceFolder(TypeMoq.It.isAny()))
                .returns(() => workspaceFolders[0]);
            resolver.setup(r => r.resolveDebugConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((_1, cfg, _2) => cfg);

            setupDebugManager(
                workspaceFolders[0],
                {
                    name: 'Debug Unit Test',
                    type: debuggerType,
                    request: 'launch',
                    program: testLaunchScript,
                    cwd: workspaceFolders[0].uri.fsPath,
                    args: options.args,
                    console: 'none',
                    debugOptions: [DebugOptions.RedirectOutput]
                },
                testProvider
            );
        }

        test(`Must launch debugger ${testTitleSuffix}`, async () => {
            const options = {
                cwd: 'one/two/three',
                args: ['/one/two/three/testfile.py'],
                testProvider
            };
            setupSuccess(options);

            await debugLauncher.launchDebugger(options);

            resolver.verifyAll();
            debugService.verifyAll();
        });
        test(`Must launch debugger with arguments ${testTitleSuffix}`, async () => {
            const options = {
                cwd: 'one/two/three',
                args: ['/one/two/three/testfile.py', '--debug', '1'],
                testProvider
            };
            setupSuccess(options);

            await debugLauncher.launchDebugger(options);

            resolver.verifyAll();
            debugService.verifyAll();
        });
        test(`Must not launch debugger if cancelled ${testTitleSuffix}`, async () => {
            debugService.setup(d => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined as any))
                .verifiable(TypeMoq.Times.never());

            const cancellationToken = new CancellationTokenSource();
            cancellationToken.cancel();
            const token = cancellationToken.token;
            const options: LaunchOptions = { cwd: '', args: [], token, testProvider };

            await expect(
                debugLauncher.launchDebugger(options)
            ).to.be.eventually.equal(undefined, 'not undefined');

            resolver.verifyAll();
            debugService.verifyAll();
        });
        test(`Must throw an exception if there are no workspaces ${testTitleSuffix}`, async () => {
            hasWorkspaceFolders = false;
            debugService.setup(d => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined as any))
                .verifiable(TypeMoq.Times.never());

            const options: LaunchOptions = { cwd: '', args: [], testProvider };

            await expect(
                debugLauncher.launchDebugger(options)
            ).to.eventually.rejectedWith('Please open a workspace');

            resolver.verifyAll();
            debugService.verifyAll();
        });
    });
});
