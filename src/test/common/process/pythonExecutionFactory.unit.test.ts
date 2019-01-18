// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';

import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessService } from '../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../client/common/process/pythonProcess';
import {
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessServiceFactory,
    IPythonExecutionService
} from '../../../client/common/process/types';
import { IConfigurationService } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
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

suite('Process - PythonExecutionFactory', () => {
    [undefined, Uri.parse('x')].forEach(resource => {
        [undefined, pythonInterpreter].forEach(interpreter => {
            suite(title(resource, interpreter), () => {
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

                    when(activationHelper.getActivatedEnvironmentVariables(resource, anything())).thenResolve();

                    const service = await factory.createActivatedEnvironment({resource, interpreter});

                    verify(activationHelper.getActivatedEnvironmentVariables(resource, anything())).once();
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

                    when(activationHelper.getActivatedEnvironmentVariables(resource, anything())).thenResolve({});

                    const service = await factory.createActivatedEnvironment({resource, interpreter});

                    verify(activationHelper.getActivatedEnvironmentVariables(resource, anything())).once();
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
                    when(activationHelper.getActivatedEnvironmentVariables(resource, anything())).thenResolve({ x: '1' });
                    when(pythonSettings.pythonPath).thenReturn('HELLO');
                    when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                    const service = await factory.createActivatedEnvironment({resource, interpreter});

                    verify(activationHelper.getActivatedEnvironmentVariables(resource, anything())).once();
                    if (!interpreter) {
                        verify(pythonSettings.pythonPath).once();
                    }
                    expect(service).instanceOf(PythonExecutionService);
                    assert.equal(createInvoked, false);
                });
            });
        });
    });
});
