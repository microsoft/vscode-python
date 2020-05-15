// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
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
    IPythonSettings
} from '../../client/common/types';
import { getNamesAndValues } from '../../client/common/utils/enum';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterHelper } from '../../client/interpreter/contracts';
import { PoetryService } from '../../client/interpreter/locators/services/poetryService';
import { PoetryServiceHelper } from '../../client/interpreter/locators/services/poetryServiceHelper';
import { IPoetryServiceHelper } from '../../client/interpreter/locators/types';
import { IServiceContainer } from '../../client/ioc/types';
import * as Telemetry from '../../client/telemetry';
import { EventName } from '../../client/telemetry/constants';

enum OS {
    Mac,
    Windows,
    Linux
}

suite('Interpreters - Poetry', () => {
    const rootWorkspace = Uri.file(path.join('usr', 'desktop', 'wkspc1')).fsPath;
    getNamesAndValues(OS).forEach((os) => {
        [undefined, Uri.file(path.join(rootWorkspace, 'one.py'))].forEach((resource) => {
            const testSuffix = ` (${os.name}, ${resource ? 'with' : 'without'} a workspace)`;

            let poetryService: PoetryService;
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
            let poetryPathSetting: string;
            let poetryServiceHelper: IPoetryServiceHelper;

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
                poetryServiceHelper = mock(PoetryServiceHelper);
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
                    .setup((c) => c.get(TypeMoq.It.isValue(IPoetryServiceHelper), TypeMoq.It.isAny()))
                    .returns(() => instance(poetryServiceHelper));

                when(poetryServiceHelper.trackWorkspaceFolder(anything(), anything())).thenResolve();
                config = TypeMoq.Mock.ofType<IConfigurationService>();
                settings = TypeMoq.Mock.ofType<IPythonSettings>();
                config.setup((c) => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => settings.object);
                settings.setup((p) => p.poetryPath).returns(() => poetryPathSetting);
                poetryPathSetting = 'poetry';

                poetryService = new PoetryService(serviceContainer.object);
            });

            suite('With didTriggerInterpreterSuggestions set to true', () => {
                setup(() => {
                    sinon.stub(poetryService, 'didTriggerInterpreterSuggestions').get(() => true);
                });

                teardown(() => {
                    sinon.restore();
                });

                test(`Should return an empty list'${testSuffix}`, () => {
                    const environments = poetryService.getInterpreters(resource);
                    expect(environments).to.be.eventually.deep.equal([]);
                });
                test(`Should return an empty list if there is no \'pyproject.toml\'${testSuffix}`, async () => {
                    const env = {};
                    envVarsProvider
                        .setup((e) => e.getEnvironmentVariables(TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve({}))
                        .verifiable(TypeMoq.Times.once());
                    currentProcess.setup((c) => c.env).returns(() => env);
                    fileSystem
                        .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'pyproject.toml'))))
                        .returns(() => Promise.resolve(false))
                        .verifiable(TypeMoq.Times.once());
                    const environments = await poetryService.getInterpreters(resource);

                    expect(environments).to.be.deep.equal([]);
                    fileSystem.verifyAll();
                });
                test(`Should display warning message if there is a \'pyproject.toml\' but \'poetry --help\' fails ${testSuffix}`, async () => {
                    const env = {};
                    currentProcess.setup((c) => c.env).returns(() => env);
                    processService
                        .setup((p) =>
                            p.exec(TypeMoq.It.isValue('poetry'), TypeMoq.It.isValue(['--help']), TypeMoq.It.isAny())
                        )
                        .returns(() => Promise.reject(''));
                    fileSystem
                        .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'pyproject.toml'))))
                        .returns(() => Promise.resolve(true));
                    const warningMessage =
                        "Workspace contains pyproject.toml but 'poetry' was not found. Make sure 'poetry' is on the PATH.";
                    appShell
                        .setup((a) => a.showWarningMessage(warningMessage))
                        .returns(() => Promise.resolve(''))
                        .verifiable(TypeMoq.Times.once());
                    const environments = await poetryService.getInterpreters(resource);

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
                        .setup((p) => p.exec(TypeMoq.It.isValue('poetry'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve({ stdout: pythonPath }));
                    interpreterHelper
                        .setup((v) => v.getInterpreterInformation(TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve({ version: new SemVer('1.0.0') }));
                    fileSystem
                        .setup((fs) => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'pyproject.toml'))))
                        .returns(() => Promise.resolve(true))
                        .verifiable();
                    fileSystem
                        .setup((fs) => fs.fileExists(TypeMoq.It.isValue(`${pythonPath}/bin/python`)))
                        .returns(() => Promise.resolve(true))
                        .verifiable();

                    const environments = await poetryService.getInterpreters(resource);

                    expect(environments).to.be.lengthOf(1);
                    fileSystem.verifyAll();
                });
                test("Must use 'python.poetryPath' setting", async () => {
                    poetryPathSetting = 'spam-spam-pipenv-spam-spam';
                    const poetryExe = poetryService.executable;
                    assert.equal(poetryExe, 'spam-spam-pipenv-spam-spam', 'Failed to identify poetry.exe');
                });

                test('Should send telemetry event when calling getInterpreters', async () => {
                    const sendTelemetryStub = sinon.stub(Telemetry, 'sendTelemetryEvent');

                    await poetryService.getInterpreters(resource);

                    sinon.assert.calledWith(sendTelemetryStub, EventName.POETRY_INTERPRETER_DISCOVERY);
                    sinon.restore();
                });
            });

            suite('With didTriggerInterpreterSuggestions set to false', () => {
                setup(() => {
                    sinon.stub(poetryService, 'didTriggerInterpreterSuggestions').get(() => false);
                });

                teardown(() => {
                    sinon.restore();
                });

                test('isRelatedPoetryEnvironment should exit early', async () => {
                    processService
                        .setup((p) => p.exec(TypeMoq.It.isValue('poetry'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .verifiable(TypeMoq.Times.never());

                    const result = await poetryService.isRelatedPoetryEnvironment('foo', 'some/python/path');

                    expect(result).to.be.equal(false, 'isRelatedPoetryEnvironment should return false.');
                    processService.verifyAll();
                });

                test('Executable getter should return an empty string', () => {
                    const executable = poetryService.executable;

                    expect(executable).to.be.equal('', 'The executable getter should return an empty string.');
                });

                test('getInterpreters should exit early', async () => {
                    processService
                        .setup((p) => p.exec(TypeMoq.It.isValue('poetry'), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .verifiable(TypeMoq.Times.never());

                    const interpreters = await poetryService.getInterpreters(resource);

                    expect(interpreters).to.be.lengthOf(0);
                    processService.verifyAll();
                });
            });
        });
    });
});
