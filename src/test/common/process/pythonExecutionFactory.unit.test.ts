// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// tslint:disable:no-any

import * as assert from 'assert';
import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessService } from '../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import { ExecutionFactoryCreationOptions, IBufferDecoder, IProcessServiceFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { IConfigurationService } from '../../../client/common/types';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { ServiceContainer } from '../../../client/ioc/container';

suite('Process - PythonExecutionFactory', () => {
    [undefined, Uri.parse('x')].forEach(resource => {
        suite(resource ? 'With a resource' : 'Without a resource', () => {
            let factory: PythonExecutionFactory;
            let activationHelper: IEnvironmentActivationService;
            let bufferDecoder: IBufferDecoder;
            let procecssFactory: IProcessServiceFactory;
            let configService: IConfigurationService;
            setup(() => {
                bufferDecoder = mock(BufferDecoder);
                activationHelper = mock(EnvironmentActivationService);
                procecssFactory = mock(ProcessServiceFactory);
                configService = mock(ConfigurationService);
                factory = new PythonExecutionFactory(instance(mock(ServiceContainer)),
                    instance(activationHelper), instance(procecssFactory),
                    instance(configService), instance(bufferDecoder));
            });

            test('Ensure PythonExecutionService is created', async () => {
                const pythonSettings = mock(PythonSettings);
                when(procecssFactory.create(resource)).thenResolve(instance(mock(ProcessService)));
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

                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve();

                const service = await factory.createActivatedEnvironment(resource);

                verify(activationHelper.getActivatedEnvironmentVariables(resource)).once();
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

                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({});

                const service = await factory.createActivatedEnvironment(resource);

                verify(activationHelper.getActivatedEnvironmentVariables(resource)).once();
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
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                const service = await factory.createActivatedEnvironment(resource);

                verify(activationHelper.getActivatedEnvironmentVariables(resource)).once();
                verify(pythonSettings.pythonPath).once();
                expect(service).instanceOf(PythonExecutionService);
                assert.equal(createInvoked, false);
            });
        });
    });
});
