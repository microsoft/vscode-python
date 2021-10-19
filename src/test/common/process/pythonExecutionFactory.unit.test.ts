// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import { anyString, anything, instance, mock, reset, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';

import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessLogger } from '../../../client/common/process/logger';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { CONDA_RUN_VERSION, PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import {
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionService,
} from '../../../client/common/process/types';
import { IConfigurationService, IDisposableRegistry, IInterpreterPathProxyService } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IComponentAdapter, ICondaService, IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { ServiceContainer } from '../../../client/ioc/container';
import { CondaService } from '../../../client/pythonEnvironments/discovery/locators/services/condaService';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import * as WindowsStoreInterpreter from '../../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import { IInterpreterAutoSelectionService } from '../../../client/interpreter/autoSelection/types';

const pythonInterpreter: PythonEnvironment = {
    path: '/foo/bar/python.exe',
    version: new SemVer('3.6.6-final'),
    sysVersion: '1.0.0.0',
    sysPrefix: 'Python',
    envType: EnvironmentType.Unknown,
    architecture: Architecture.x64,
};

function title(resource?: Uri, interpreter?: PythonEnvironment) {
    return `${resource ? 'With a resource' : 'Without a resource'}${interpreter ? ' and an interpreter' : ''}`;
}

async function verifyCreateActivated(
    factory: PythonExecutionFactory,
    activationHelper: IEnvironmentActivationService,
    resource?: Uri,
    interpreter?: PythonEnvironment,
): Promise<IPythonExecutionService> {
    when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve();

    const service = await factory.createActivatedEnvironment({ resource, interpreter });

    verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();

    return service;
}

suite('Process - PythonExecutionFactory', () => {
    [
        { resource: undefined, interpreter: undefined },
        { resource: undefined, interpreter: pythonInterpreter },
        { resource: Uri.parse('x'), interpreter: undefined },
        { resource: Uri.parse('x'), interpreter: pythonInterpreter },
    ].forEach((item) => {
        const { resource } = item;
        const { interpreter } = item;
        suite(title(resource, interpreter), () => {
            let factory: PythonExecutionFactory;
            let activationHelper: IEnvironmentActivationService;
            let bufferDecoder: IBufferDecoder;
            let processFactory: IProcessServiceFactory;
            let configService: IConfigurationService;
            let condaService: ICondaService;
            let processLogger: IProcessLogger;
            let processService: typemoq.IMock<IProcessService>;
            let interpreterService: IInterpreterService;
            let pyenvs: IComponentAdapter;
            let executionService: typemoq.IMock<IPythonExecutionService>;
            let isWindowsStoreInterpreterStub: sinon.SinonStub;
            let autoSelection: IInterpreterAutoSelectionService;
            let interpreterPathExpHelper: IInterpreterPathProxyService;
            setup(() => {
                bufferDecoder = mock(BufferDecoder);
                activationHelper = mock(EnvironmentActivationService);
                processFactory = mock(ProcessServiceFactory);
                configService = mock(ConfigurationService);
                condaService = mock(CondaService);
                processLogger = mock(ProcessLogger);
                autoSelection = mock<IInterpreterAutoSelectionService>();
                interpreterPathExpHelper = mock<IInterpreterPathProxyService>();
                when(interpreterPathExpHelper.get(anything())).thenReturn('selected interpreter path');

                pyenvs = mock<IComponentAdapter>();
                when(pyenvs.isWindowsStoreInterpreter(anyString())).thenResolve(true);

                executionService = typemoq.Mock.ofType<IPythonExecutionService>();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                executionService.setup((p: any) => p.then).returns(() => undefined);
                when(processLogger.logProcess('', [], {})).thenReturn();
                processService = typemoq.Mock.ofType<IProcessService>();
                processService
                    .setup((p) =>
                        p.on('exec', () => {
                            /** No body */
                        }),
                    )
                    .returns(() => processService.object);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                processService.setup((p: any) => p.then).returns(() => undefined);
                interpreterService = mock(InterpreterService);
                when(interpreterService.getInterpreterDetails(anything())).thenResolve({
                    version: { major: 3 },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
                const serviceContainer = mock(ServiceContainer);
                when(serviceContainer.get<IDisposableRegistry>(IDisposableRegistry)).thenReturn([]);
                when(serviceContainer.get<IProcessLogger>(IProcessLogger)).thenReturn(processLogger);
                when(serviceContainer.get<IInterpreterService>(IInterpreterService)).thenReturn(
                    instance(interpreterService),
                );
                when(serviceContainer.get<IComponentAdapter>(IComponentAdapter)).thenReturn(instance(pyenvs));
                when(serviceContainer.tryGet<IInterpreterService>(IInterpreterService)).thenReturn(
                    instance(interpreterService),
                );
                factory = new PythonExecutionFactory(
                    instance(serviceContainer),
                    instance(activationHelper),
                    instance(processFactory),
                    instance(configService),
                    instance(condaService),
                    instance(bufferDecoder),
                    instance(pyenvs),
                    instance(autoSelection),
                    instance(interpreterPathExpHelper),
                );

                isWindowsStoreInterpreterStub = sinon.stub(WindowsStoreInterpreter, 'isWindowsStoreInterpreter');
                isWindowsStoreInterpreterStub.resolves(true);
            });

            teardown(() => sinon.restore());

            test('Ensure PythonExecutionService is created', async () => {
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
            });

            test('If interpreter is explicitly set, ensure we use it', async () => {
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                reset(interpreterPathExpHelper);
                when(interpreterPathExpHelper.get(anything())).thenReturn('python');
                when(autoSelection.autoSelectInterpreter(anything())).thenResolve();
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource, pythonPath: 'HELLO' });

                expect(service).to.not.equal(undefined);
                verify(pyenvs.isWindowsStoreInterpreter('HELLO')).once();
                verify(pythonSettings.pythonPath).never();
            });

            test('If no interpreter is explicitly set, ensure we autoselect before PythonExecutionService is created', async () => {
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                reset(interpreterPathExpHelper);
                when(interpreterPathExpHelper.get(anything())).thenReturn('python');
                when(autoSelection.autoSelectInterpreter(anything())).thenResolve();
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(autoSelection.autoSelectInterpreter(anything())).once();
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
            });

            test('Ensure we use an existing `create` method if there are no environment variables for the activated env', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async () => {
                    createInvoked = true;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const service = await verifyCreateActivated(factory, activationHelper, resource, interpreter);
                assert.deepEqual(service, mockExecService);
                assert.equal(createInvoked, true);
            });
            test('Ensure we use an existing `create` method if there are no environment variables (0 length) for the activated env', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async () => {
                    createInvoked = true;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const service = await verifyCreateActivated(factory, activationHelper, resource, interpreter);
                assert.deepEqual(service, mockExecService);
                assert.equal(createInvoked, true);
            });
            test('PythonExecutionService is created', async () => {
                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async () => {
                    createInvoked = true;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1',
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                expect(service).to.not.equal(undefined);
                verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                }
                assert.equal(createInvoked, false);
            });

            test("Ensure `create` returns a WindowsStorePythonProcess instance if it's a windows store intepreter path and we're in the discovery experiment", async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(pyenvs.isWindowsStoreInterpreter(pythonPath)).once();
                sinon.assert.notCalled(isWindowsStoreInterpreterStub);
            });

            test('Ensure `create` returns a CondaExecutionService instance if createCondaExecutionService() returns a valid object', async function () {
                return this.skip();

                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(interpreterService.hasInterpreters()).thenResolve(true);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(pyenvs.getCondaEnvironment(pythonPath)).thenResolve({
                    name: 'foo',
                    path: 'path/to/foo/env',
                });
                when(condaService.getCondaFile()).thenResolve('conda');

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(condaService.getCondaVersion()).once();
                verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `create` returns a PythonExecutionService instance if createCondaExecutionService() returns undefined', async function () {
                return this.skip();

                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer('1.0.0'));
                when(interpreterService.hasInterpreters()).thenResolve(true);

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(condaService.getCondaVersion()).once();
                verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createActivatedEnvironment` returns a CondaExecutionService instance if createCondaExecutionService() returns a valid object', async function () {
                return this.skip();

                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1',
                });
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(pyenvs.getCondaEnvironment(anyString())).thenResolve({
                    name: 'foo',
                    path: 'path/to/foo/env',
                });
                when(condaService.getCondaFile()).thenResolve('conda');

                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                expect(service).to.not.equal(undefined);
                verify(condaService.getCondaFile()).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                    verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                } else {
                    verify(pyenvs.getCondaEnvironment(interpreter!.path)).once();
                }
            });

            test('Ensure `createActivatedEnvironment` returns a PythonExecutionService instance if createCondaExecutionService() returns undefined', async function () {
                return this.skip();

                let createInvoked = false;
                const pythonPath = 'path/to/python';
                const mockExecService = 'mockService';
                factory.create = async () => {
                    createInvoked = true;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1',
                });
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer('1.0.0'));

                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                expect(service).to.not.equal(undefined);
                verify(condaService.getCondaFile()).once();
                verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();
                verify(condaService.getCondaVersion()).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                }

                assert.equal(createInvoked, false);
            });

            test('Ensure `createCondaExecutionService` creates a CondaExecutionService instance if there is a conda environment', async () => {
                const pythonPath = 'path/to/python';
                when(pyenvs.getCondaEnvironment(pythonPath)).thenResolve({
                    name: 'foo',
                    path: 'path/to/foo/env',
                });
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(condaService.getCondaFile()).thenResolve('conda');

                const result = await factory.createCondaExecutionService(pythonPath, processService.object, resource);

                expect(result).to.not.equal(undefined);
                verify(condaService.getCondaVersion()).once();
                verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createCondaExecutionService` instantiates a ProcessService instance if the process argument is undefined', async () => {
                const pythonPath = 'path/to/python';
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pyenvs.getCondaEnvironment(pythonPath)).thenResolve({
                    name: 'foo',
                    path: 'path/to/foo/env',
                });
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(condaService.getCondaFile()).thenResolve('conda');

                const result = await factory.createCondaExecutionService(pythonPath, undefined, resource);

                expect(result).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(condaService.getCondaVersion()).once();
                verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createCondaExecutionService` returns undefined if there is no conda environment', async () => {
                const pythonPath = 'path/to/python';
                when(pyenvs.getCondaEnvironment(pythonPath)).thenResolve(undefined);
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));

                const result = await factory.createCondaExecutionService(pythonPath, processService.object);

                expect(result).to.be.equal(
                    undefined,
                    'createCondaExecutionService should return undefined if not in a conda environment',
                );
                verify(condaService.getCondaVersion()).once();
                verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createCondaExecutionService` returns undefined if the conda version does not support conda run', async () => {
                const pythonPath = 'path/to/python';
                when(condaService.getCondaVersion()).thenResolve(new SemVer('1.0.0'));

                const result = await factory.createCondaExecutionService(pythonPath, processService.object);

                expect(result).to.be.equal(
                    undefined,
                    'createCondaExecutionService should return undefined if not in a conda environment',
                );
                verify(condaService.getCondaVersion()).once();
                verify(pyenvs.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });
        });
    });
});
