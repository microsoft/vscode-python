// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { CancellationTokenSource, Uri, WorkspaceFolder } from 'vscode';
import { IDebugService, IWorkspaceService } from '../../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import '../../../client/common/extensions';
import { IConfigurationService, IPythonSettings, IUnitTestSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { DebugLauncher } from '../../../client/unittests/common/debugLauncher';
import { TestProvider } from '../../../client/unittests/common/types';

use(chaiAsPromised);

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - Debug Launcher', () => {
    let unitTestSettings: TypeMoq.IMock<IUnitTestSettings>;
    let debugLauncher: DebugLauncher;
    let debugService: TypeMoq.IMock<IDebugService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    setup(async () => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);

        debugService = TypeMoq.Mock.ofType<IDebugService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDebugService))).returns(() => debugService.object);

        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);

        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);

        unitTestSettings = TypeMoq.Mock.ofType<IUnitTestSettings>();
        settings.setup(p => p.unitTest).returns(() => unitTestSettings.object);

        debugLauncher = new DebugLauncher(serviceContainer.object);
    });
    function setupDebugManager(workspaceFolder: WorkspaceFolder, name: string, type: string,
        request: string, program: string, cwd: string,
        args: string[], console, debugOptions: string[],
        testProvider: TestProvider, useExperimentalDebugger: boolean) {

        const debugArgs = testProvider === 'unittest' && useExperimentalDebugger ? args.filter(item => item !== '--debug') : args;

        debugService.setup(d => d.startDebugging(TypeMoq.It.isValue(workspaceFolder),
            TypeMoq.It.isObjectWith({ name, type, request, program, cwd, args: debugArgs, console, debugOptions })))
            .returns(() => Promise.resolve(undefined as any))
            .verifiable(TypeMoq.Times.once());
    }
    function createWorkspaceFolder(folderPath: string): WorkspaceFolder {
        return { index: 0, name: path.basename(folderPath), uri: Uri.file(folderPath) };
    }
    function getTestLauncherScript(testProvider: TestProvider, useExperimentalDebugger: boolean) {
        switch (testProvider) {
            case 'unittest': {
                return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
            }
            case 'pytest':
            case 'nosetest': {
                if (useExperimentalDebugger) {
                    return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'testlauncher.py');
                } else {
                    return path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'testlauncher.py');
                }

            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
    const testProviders: TestProvider[] = ['nosetest', 'pytest', 'unittest'];
    testProviders.forEach(testProvider => {
        [true, false].forEach(useExperimentalDebugger => {
            const testTitleSuffix = `(Test Framework '${testProvider}', and use experimental debugger = '${useExperimentalDebugger}'`;
            const testLaunchScript = getTestLauncherScript(testProvider, useExperimentalDebugger);
            const debuggerType = useExperimentalDebugger ? 'pythonExperimental' : 'python';

            test(`Must launch debugger ${testTitleSuffix}`, async () => {
                unitTestSettings.setup(u => u.useExperimentalDebugger).returns(() => useExperimentalDebugger);
                workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => true);
                const workspaceFolders = [createWorkspaceFolder('one/two/three'), createWorkspaceFolder('five/six/seven')];
                workspaceService.setup(u => u.workspaceFolders).returns(() => workspaceFolders);
                workspaceService.setup(u => u.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolders[0]);

                const args = ['/one/two/three/testfile.py'];
                const cwd = workspaceFolders[0].uri.fsPath;
                const program = testLaunchScript;
                setupDebugManager(workspaceFolders[0], 'Debug Unit Test', debuggerType, 'launch', program, cwd, args, 'none', ['RedirectOutput'], testProvider, useExperimentalDebugger);

                debugLauncher.launchDebugger({ cwd, args, testProvider }).ignoreErrors();
                debugService.verifyAll();
            });
            test(`Must launch debugger with arguments ${testTitleSuffix}`, async () => {
                unitTestSettings.setup(u => u.useExperimentalDebugger).returns(() => useExperimentalDebugger);
                workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => true);
                const workspaceFolders = [createWorkspaceFolder('one/two/three'), createWorkspaceFolder('five/six/seven')];
                workspaceService.setup(u => u.workspaceFolders).returns(() => workspaceFolders);
                workspaceService.setup(u => u.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolders[0]);

                const args = ['/one/two/three/testfile.py', '--debug', '1'];
                const cwd = workspaceFolders[0].uri.fsPath;
                const program = testLaunchScript;
                setupDebugManager(workspaceFolders[0], 'Debug Unit Test', debuggerType, 'launch', program, cwd, args, 'none', ['RedirectOutput'], testProvider, useExperimentalDebugger);

                debugLauncher.launchDebugger({ cwd, args, testProvider }).ignoreErrors();
                debugService.verifyAll();
            });
            test(`Must not launch debugger if cancelled ${testTitleSuffix}`, async () => {
                unitTestSettings.setup(u => u.useExperimentalDebugger).returns(() => false);
                workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => true);

                debugService.setup(d => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined as any))
                    .verifiable(TypeMoq.Times.never());

                const cancellationToken = new CancellationTokenSource();
                cancellationToken.cancel();
                const token = cancellationToken.token;
                expect(debugLauncher.launchDebugger({ cwd: '', args: [], token, testProvider })).to.be.eventually.equal(undefined, 'not undefined');
                debugService.verifyAll();
            });
            test(`Must throw an exception if there are no workspaces ${testTitleSuffix}`, async () => {
                unitTestSettings.setup(u => u.useExperimentalDebugger).returns(() => false);
                workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => false);

                debugService.setup(d => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined as any))
                    .verifiable(TypeMoq.Times.never());

                expect(debugLauncher.launchDebugger({ cwd: '', args: [], testProvider })).to.eventually.throw('Please open a workspace');
                debugService.verifyAll();
            });
        });
    });
});
