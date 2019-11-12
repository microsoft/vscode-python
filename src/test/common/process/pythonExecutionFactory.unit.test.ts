// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { CondaExecutionService } from '../../../client/common/process/condaExecutionService';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessLogger } from '../../../client/common/process/logger';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { PythonDaemonExecutionServicePool } from '../../../client/common/process/pythonDaemonPool';
import { CONDA_RUN_VERSION, PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import {
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionService
} from '../../../client/common/process/types';
import { WindowsStorePythonProcess } from '../../../client/common/process/windowsStorePythonProcess';
import { IConfigurationService, IDisposableRegistry } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { ICondaService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { WindowsStoreInterpreter } from '../../../client/interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../../client/interpreter/locators/types';
import { ServiceContainer } from '../../../client/ioc/container';

// tslint:disable:no-any max-func-body-length

const pythonInterpreter: PythonInterpreter = {
    path: '/foo/bar/python.exe',
    version: new SemVer('3.6.6-final'),
    sysVersion: '1.0.0.0',
    sysPrefix: 'Python',
    type: InterpreterType.Unknown,
    architecture: Architecture.x64
};

function title(resource?: Uri, interpreter?: PythonInterpreter) {
    return `${resource ? 'With a resource' : 'Without a resource'}${interpreter ? ' and an interpreter' : ''}`;
}

async function verifyCreateActivated(factory: PythonExecutionFactory, activationHelper: IEnvironmentActivationService, resource?: Uri, interpreter?: PythonInterpreter): Promise<IPythonExecutionService> {
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
        { resource: Uri.parse('x'), interpreter: pythonInterpreter }
    ].forEach(item => {
        const resource = item.resource;
        const interpreter = item.interpreter;
        suite(title(resource, interpreter), () => {
            let factory: PythonExecutionFactory;
            let activationHelper: IEnvironmentActivationService;
            let bufferDecoder: IBufferDecoder;
            let processFactory: IProcessServiceFactory;
            let configService: IConfigurationService;
            let condaService: ICondaService;
            let processLogger: IProcessLogger;
            let processService: typemoq.IMock<IProcessService>;
            let windowsStoreInterpreter: IWindowsStoreInterpreter;
            setup(() => {
                bufferDecoder = mock(BufferDecoder);
                activationHelper = mock(EnvironmentActivationService);
                processFactory = mock(ProcessServiceFactory);
                configService = mock(ConfigurationService);
                condaService = mock(CondaService);
                processLogger = mock(ProcessLogger);
                windowsStoreInterpreter = mock(WindowsStoreInterpreter);
                when(processLogger.logProcess('', [], {})).thenReturn();
                processService = typemoq.Mock.ofType<IProcessService>();
                processService
                    .setup(p =>
                        p.on('exec', () => {
                            return;
                        })
                    )
                    .returns(() => processService.object);
                processService.setup((p: any) => p.then).returns(() => undefined);
                const serviceContainer = mock(ServiceContainer);
                when(serviceContainer.get<IDisposableRegistry>(IDisposableRegistry)).thenReturn([]);
                when(serviceContainer.get<IProcessLogger>(IProcessLogger)).thenReturn(processLogger);
                factory = new PythonExecutionFactory(
                    instance(serviceContainer),
                    instance(activationHelper),
                    instance(processFactory),
                    instance(configService),
                    instance(condaService),
                    instance(bufferDecoder),
                    instance(windowsStoreInterpreter)
                );
            });
            teardown(() => sinon.restore());
            test('Ensure PythonExecutionService is created', async () => {
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource });

                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                expect(service).instanceOf(PythonExecutionService);
            });
            test('Ensure we use an existing `create` method if there are no environment variables for the activated env', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve(mockExecService as any as IPythonExecutionService);
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
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve(mockExecService as any as IPythonExecutionService);
                };

                const service = await verifyCreateActivated(factory, activationHelper, resource, interpreter);
                assert.deepEqual(service, mockExecService);
                assert.equal(createInvoked, true);
            });
            test('PythonExecutionService is created', async () => {
                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve(mockExecService as any as IPythonExecutionService);
                };

                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                }
                expect(service).instanceOf(PythonExecutionService);
                assert.equal(createInvoked, false);
            });

            test('Ensure `create` returns a WindowsStorePythonProcess instance if it\'s a windows store intepreter path', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenReturn(true);

                const service = await factory.create({ resource });

                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).once();
                expect(service).instanceOf(WindowsStorePythonProcess);
            });

            test('Ensure `create` returns a CondaExecutionService instance if createCondaExecutionService() returns a valid object', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(condaService.getCondaEnvironment(pythonPath)).thenResolve({ name: 'foo', path: 'path/to/foo/env' });
                when(condaService.getCondaFile()).thenResolve('conda');

                const service = await factory.create({ resource });

                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(condaService.getCondaVersion()).once();
                verify(condaService.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
                expect(service).instanceOf(CondaExecutionService);
            });

            test('Ensure `create` returns a PythonExecutionService instance if createCondaExecutionService() returns undefined', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer('1.0.0'));

                const service = await factory.create({ resource });

                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(condaService.getCondaVersion()).once();
                verify(condaService.getCondaEnvironment(pythonPath)).never();
                verify(condaService.getCondaFile()).never();
                expect(service).instanceOf(PythonExecutionService);
            });

            test('Ensure `createActivatedEnvironment` returns a CondaExecutionService instance if createCondaExecutionService() returns a valid object', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(condaService.getCondaEnvironment(anyString())).thenResolve({ name: 'foo', path: 'path/to/foo/env' });
                when(condaService.getCondaFile()).thenResolve('conda');

                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                verify(condaService.getCondaFile()).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.getCondaEnvironment(pythonPath)).once();
                } else {
                    verify(condaService.getCondaEnvironment(interpreter.path)).once();
                }

                expect(service).instanceOf(CondaExecutionService);
            });

            test('Ensure `createActivatedEnvironment` returns a PythonExecutionService instance if createCondaExecutionService() returns undefined', async () => {
                let createInvoked = false;
                const pythonPath = 'path/to/python';
                const mockExecService = 'mockService';
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(condaService.getCondaVersion()).thenResolve(new SemVer('1.0.0'));

                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                verify(condaService.getCondaFile()).never();
                verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();
                verify(condaService.getCondaVersion()).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                }

                expect(service).instanceOf(PythonExecutionService);
                assert.equal(createInvoked, false);
            });

            test('Ensure `createCondaExecutionService` creates a CondaExecutionService instance if there is a conda environment', async () => {
                const pythonPath = 'path/to/python';
                when(condaService.getCondaEnvironment(pythonPath)).thenResolve({ name: 'foo', path: 'path/to/foo/env' });
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(condaService.getCondaFile()).thenResolve('conda');

                const result = await factory.createCondaExecutionService(pythonPath, processService.object, resource);

                expect(result).instanceOf(CondaExecutionService);
                verify(condaService.getCondaVersion()).once();
                verify(condaService.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createCondaExecutionService` instantiates a ProcessService instance if the process argument is undefined', async () => {
                const pythonPath = 'path/to/python';
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(condaService.getCondaEnvironment(pythonPath)).thenResolve({ name: 'foo', path: 'path/to/foo/env' });
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));
                when(condaService.getCondaFile()).thenResolve('conda');

                const result = await factory.createCondaExecutionService(pythonPath, undefined, resource);

                expect(result).instanceOf(CondaExecutionService);
                verify(processFactory.create(resource)).once();
                verify(condaService.getCondaVersion()).once();
                verify(condaService.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createCondaExecutionService` returns undefined if there is no conda environment', async () => {
                const pythonPath = 'path/to/python';
                when(condaService.getCondaEnvironment(pythonPath)).thenResolve(undefined);
                when(condaService.getCondaVersion()).thenResolve(new SemVer(CONDA_RUN_VERSION));

                const result = await factory.createCondaExecutionService(pythonPath, processService.object);

                expect(result).to.be.equal(undefined, 'createCondaExecutionService should return undefined if not in a conda environment');
                verify(condaService.getCondaVersion()).once();
                verify(condaService.getCondaEnvironment(pythonPath)).once();
                verify(condaService.getCondaFile()).once();
            });

            test('Ensure `createCondaExecutionService` returns undefined if the conda version does not support conda run', async () => {
                const pythonPath = 'path/to/python';
                when(condaService.getCondaVersion()).thenResolve(new SemVer('1.0.0'));

                const result = await factory.createCondaExecutionService(pythonPath, processService.object);

                expect(result).to.be.equal(undefined, 'createCondaExecutionService should return undefined if not in a conda environment');
                verify(condaService.getCondaVersion()).once();
                verify(condaService.getCondaEnvironment(pythonPath)).never();
                verify(condaService.getCondaFile()).never();
            });
            test('Create Daemon Service an invoke initialize', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(undefined as any);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon = await factory.createDaemon({});

                expect(daemon).instanceOf(PythonDaemonExecutionServicePool);
                expect(initialize.callCount).to.equal(1);
            });
            test('Create Daemon Service should return the same daemon when created one after another', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(undefined as any);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon1 = await factory.createDaemon({});
                const daemon2 = await factory.createDaemon({});

                expect(daemon1).to.equal(daemon2);
            });
            test('Create Daemon Service should return two different daemons (if python path is different)', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(undefined as any);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon1 = await factory.createDaemon({});

                when(pythonSettings.pythonPath).thenReturn('HELLO2');
                const daemon2 = await factory.createDaemon({});

                expect(daemon1).to.not.equal(daemon2);
            });
            test('Create Daemon Service should return the same daemon when created in parallel', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(undefined as any);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const [daemon1, daemon2] = await Promise.all([factory.createDaemon({}), factory.createDaemon({})]);

                expect(daemon1).to.equal(daemon2);
            });
            test('Failure to create Daemon Service should return PythonExecutionService', async () => {
                const pythonSettings = mock(PythonSettings);
                const pythonExecService = { dummy: 1 } as any as IPythonExecutionService;
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(pythonExecService);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.reject(new Error('Kaboom')));

                const daemon = await factory.createDaemon({});

                expect(daemon).not.instanceOf(PythonDaemonExecutionServicePool);
                expect(initialize.callCount).to.equal(1);
                expect(daemon).equal(pythonExecService);
            });
        });
    });
});
