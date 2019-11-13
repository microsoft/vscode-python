// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessLogger } from '../../../client/common/process/logger';
import { ProcessService } from '../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { PythonDaemonExecutionServicePool } from '../../../client/common/process/pythonDaemonPool';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import {
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessServiceFactory,
    IPythonExecutionService
} from '../../../client/common/process/types';
import { IConfigurationService, IDisposableRegistry } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
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
            let procecssFactory: IProcessServiceFactory;
            let configService: IConfigurationService;
            let processLogger: IProcessLogger;
            let processService: ProcessService;
            let windowsStoreInterpreter: IWindowsStoreInterpreter;
            setup(() => {
                bufferDecoder = mock(BufferDecoder);
                activationHelper = mock(EnvironmentActivationService);
                procecssFactory = mock(ProcessServiceFactory);
                configService = mock(ConfigurationService);
                processLogger = mock(ProcessLogger);
                windowsStoreInterpreter = mock(WindowsStoreInterpreter);
                when(processLogger.logProcess('', [], {})).thenReturn();
                processService = mock(ProcessService);
                when(processService.on('exec', () => { return; })).thenReturn(processService);
                const serviceContainer = mock(ServiceContainer);
                when(serviceContainer.get<IDisposableRegistry>(IDisposableRegistry)).thenReturn([]);
                when(serviceContainer.get<IProcessLogger>(IProcessLogger)).thenReturn(processLogger);
                factory = new PythonExecutionFactory(instance(serviceContainer),
                    instance(activationHelper), instance(procecssFactory),
                    instance(configService), instance(bufferDecoder),
                    instance(windowsStoreInterpreter));
            });
            teardown(() => sinon.restore());
            test('Ensure PythonExecutionService is created', async () => {
                const pythonSettings = mock(PythonSettings);
                when(procecssFactory.create(resource)).thenResolve(instance(processService));
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource });

                verify(procecssFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                expect(service).instanceOf(PythonExecutionService);
            });
            test('Ensure we use an existing `create` method if there are no environment variables for the activated env', async () => {
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
