// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import {
    IConfigurationService,
    ICurrentProcess,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
} from '../../client/common/types';
import { getNamesAndValues } from '../../client/common/utils/enum';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterHelper } from '../../client/interpreter/contracts';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../../client/interpreter/locators/services/pipEnvServiceHelper';
import { IPipEnvServiceHelper } from '../../client/interpreter/locators/types';
import { IServiceContainer } from '../../client/ioc/types';

enum OS {
    Mac,
    Windows,
    Linux,
}

suite('Interpreters - PipEnv', () => {
    const rootWorkspace = Uri.file(path.join('usr', 'desktop', 'wkspc1')).fsPath;
    getNamesAndValues(OS).forEach((os) => {
        [undefined, Uri.file(path.join(rootWorkspace, 'one.py'))].forEach((resource) => {
            const testSuffix = ` (${os.name}, ${resource ? 'with' : 'without'} a workspace)`;

            let pipEnvService: PipEnvService;
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let interpreterHelper: TypeMoq.IMock<IInterpreterHelper>;
            let processService: TypeMoq.IMock<IProcessService>;
            let currentProcess: TypeMoq.IMock<ICurrentProcess>;
            let fileSystem: TypeMoq.IMock<IFileSystem>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
            let envVarsProvider: TypeMoq.IMock<IEnvironmentVariablesProvider>;
            let procServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
            let platformService: TypeMoq.IMock<IPlatformService>;
            let config: TypeMoq.IMock<IConfigurationService>;
            let settings: TypeMoq.IMock<IPythonSettings>;
            let pipenvPathSetting: string;
            let pipEnvServiceHelper: IPipEnvServiceHelper;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                interpreterHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
                fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                processService = TypeMoq.Mock.ofType<IProcessService>();
                appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                currentProcess = TypeMoq.Mock.ofType<ICurrentProcess>();
                persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
                envVarsProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
                procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
                platformService = TypeMoq.Mock.ofType<IPlatformService>();
                pipEnvServiceHelper = mock(PipEnvServiceHelper);
                processService.setup((x: any) => x.then).returns(() => undefined);
                procServiceFactory
                    .setup((p) => p.create(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve(processService.object));

                // tslint:disable-next-line:no-any
                const persistentState = TypeMoq.Mock.ofType<IPersistentState<any>>();
                persistentStateFactory
                    .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => persistentState.object);
                persistentStateFactory
                    .setup((p) => p.createWorkspacePersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => persistentState.object);
                persistentState.setup((p) => p.value).returns(() => undefined);
                persistentState.setup((p) => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());

                const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
                workspaceFolder.setup((w) => w.uri).returns(() => Uri.file(rootWorkspace));
                workspaceService
                    .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isAny()))
                    .returns(() => workspaceFolder.object);
                workspaceService.setup((w) => w.rootPath).returns(() => rootWorkspace);

                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IProcessServiceFactory), TypeMoq.It.isAny()))
                    .returns(() => procServiceFactory.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
                    .returns(() => workspaceService.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterHelper)))
                    .returns(() => interpreterHelper.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess)))
                    .returns(() => currentProcess.object);
                serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell)))
                    .returns(() => appShell.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IPersistentStateFactory)))
                    .returns(() => persistentStateFactory.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider)))
                    .returns(() => envVarsProvider.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService)))
                    .returns(() => platformService.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
                    .returns(() => config.object);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IPipEnvServiceHelper), TypeMoq.It.isAny()))
                    .returns(() => instance(pipEnvServiceHelper));

                when(pipEnvServiceHelper.trackWorkspaceFolder(anything(), anything())).thenResolve();
                config = TypeMoq.Mock.ofType<IConfigurationService>();
                settings = TypeMoq.Mock.ofType<IPythonSettings>();
                config.setup((c) => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => settings.object);
                settings.setup((p) => p.pipenvPath).returns(() => pipenvPathSetting);
                pipenvPathSetting = 'pipenv';

                pipEnvService = new PipEnvService(serviceContainer.object);
            });

            test(`Should return an empty list'${testSuffix}`, () => {
                const environments = pipEnvService.getInterpreters(resource);
                expect(environments).to.be.eventually.deep.equal([]);
            });
            test(`Should return an empty list if there is no \'PipFile\'${testSuffix}`, async () => {
                const env = {};
                envVarsProvider
                    .setup((e) => e.getEnvironmentVariables(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({}))
                    .verifiable(TypeMoq.Times.once());
                currentProcess.setup((c) => c.env).returns(() => env);
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile'))))
                    .returns(() => Promise.resolve(false))
                    .verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                fileSystem.verifyAll();
            });
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --version\' fails ${testSuffix}`, async () => {
                const env = {};
                currentProcess.setup((c) => c.env).returns(() => env);
                processService
                    .setup((p) =>
                        p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())
                    )
                    .returns(() => Promise.reject(''));
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile'))))
                    .returns(() => Promise.resolve(true));
                const warningMessage =
                    "Workspace contains Pipfile but 'pipenv' was not found. Make sure 'pipenv' is on the PATH.";
                appShell
                    .setup((a) => a.showWarningMessage(warningMessage))
                    .returns(() => Promise.resolve(''))
                    .verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
            });
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' fails with stderr ${testSuffix}`, async () => {
                const env = {};
                currentProcess.setup((c) => c.env).returns(() => env);
                processService
                    .setup((p) =>
                        p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())
                    )
                    .returns(() => Promise.resolve({ stderr: '', stdout: 'pipenv, version 2018.11.26' }));
                processService
                    .setup((p) =>
                        p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isValue(['--venv']), TypeMoq.It.isAny())
                    )
                    .returns(() => Promise.resolve({ stderr: 'Aborted!', stdout: '' }));
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile'))))
                    .returns(() => Promise.resolve(true));
                const warningMessage =
                    'Workspace contains Pipfile but the associated virtual environment has not been setup. Setup the virtual environment manually if needed.';
                appShell
                    .setup((a) => a.showWarningMessage(warningMessage))
                    .returns(() => Promise.resolve(''))
                    .verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
            });
            test(`Should return interpreter information${testSuffix}`, async () => {
                const env = {};
                const pythonPath = 'one';
                envVarsProvider
                    .setup((e) => e.getEnvironmentVariables(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({}))
                    .verifiable(TypeMoq.Times.once());
                currentProcess.setup((c) => c.env).returns(() => env);
                processService
                    .setup((p) => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({ stdout: pythonPath }));
                interpreterHelper
                    .setup((v) => v.getInterpreterInformation(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({ version: new SemVer('1.0.0') }));
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile'))))
                    .returns(() => Promise.resolve(true))
                    .verifiable();
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(true))
                    .verifiable();

                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
            });
            test(`Should return interpreter information using PipFile defined in Env variable${testSuffix}`, async () => {
                const envPipFile = 'XYZ';
                const env = {
                    PIPENV_PIPFILE: envPipFile,
                };
                const pythonPath = 'one';
                envVarsProvider
                    .setup((e) => e.getEnvironmentVariables(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({}))
                    .verifiable(TypeMoq.Times.once());
                currentProcess.setup((c) => c.env).returns(() => env);
                processService
                    .setup((p) => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({ stdout: pythonPath }));
                interpreterHelper
                    .setup((v) => v.getInterpreterInformation(TypeMoq.It.isAny()))
                    .returns(() => Promise.resolve({ version: new SemVer('1.0.0') }));
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile'))))
                    .returns(() => Promise.resolve(false))
                    .verifiable(TypeMoq.Times.never());
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, envPipFile))))
                    .returns(() => Promise.resolve(true))
                    .verifiable(TypeMoq.Times.once());
                fileSystem
                    .setup((fs) => fs.fileExists(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(true))
                    .verifiable();
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
            });
            test("Must use 'python.pipenvPath' setting", async () => {
                pipenvPathSetting = 'spam-spam-pipenv-spam-spam';
                const pipenvExe = pipEnvService.executable;
                assert.equal(pipenvExe, 'spam-spam-pipenv-spam-spam', 'Failed to identify pipenv.exe');
            });
        });
    });
});
