// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as path from 'path';
import { instance, mock, when } from 'ts-mockito';
import * as Typemoq from 'typemoq';
import { Event, Uri } from 'vscode';
import { buildApi } from '../client/api';
import { ConfigurationService } from '../client/common/configuration/service';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { IConfigurationService } from '../client/common/types';
import { IInterpreterService } from '../client/interpreter/contracts';
import { InterpreterService } from '../client/interpreter/interpreterService';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';

suite('Extension API', () => {
    const debuggerPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy');
    const debuggerHost = 'somehost';
    const debuggerPort = 12345;

    let serviceContainer: IServiceContainer;
    let serviceManager: IServiceManager;
    let configurationService: IConfigurationService;
    let interpreterService: IInterpreterService;

    setup(() => {
        serviceContainer = mock(ServiceContainer);
        serviceManager = mock(ServiceManager);
        configurationService = mock(ConfigurationService);
        interpreterService = mock(InterpreterService);

        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
            instance(configurationService),
        );
        when(serviceContainer.get<IInterpreterService>(IInterpreterService)).thenReturn(instance(interpreterService));
    });

    test('Execution details settings API returns expected object if interpreter is set', async () => {
        const resource = Uri.parse('a');
        when(configurationService.getSettings(resource)).thenReturn({ pythonPath: 'settingValue' } as any);

        const execDetails = buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer),
        ).settings.getExecutionDetails(resource);

        assert.deepEqual(execDetails, { execCommand: ['settingValue'] });
    });

    test('Execution details settings API returns `undefined` if interpreter is set', async () => {
        const resource = Uri.parse('a');
        when(configurationService.getSettings(resource)).thenReturn({ pythonPath: '' } as any);

        const execDetails = buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer),
        ).settings.getExecutionDetails(resource);

        assert.deepEqual(execDetails, { execCommand: undefined });
    });

    test('Provide a callback which is called when interpreter setting changes', async () => {
        const expectedEvent = Typemoq.Mock.ofType<Event<Uri | undefined>>().object;
        when(interpreterService.onDidChangeInterpreterConfiguration).thenReturn(expectedEvent);

        const result = buildApi(Promise.resolve(), instance(serviceManager), instance(serviceContainer)).settings
            .onDidChangeExecutionDetails;

        assert.deepEqual(result, expectedEvent);
    });

    test('Test debug launcher args (no-wait)', async () => {
        const waitForAttach = false;

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer),
        ).debug.getRemoteLauncherCommand(debuggerHost, debuggerPort, waitForAttach);
        const expectedArgs = [debuggerPath.fileToCommandArgument(), '--listen', `${debuggerHost}:${debuggerPort}`];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait)', async () => {
        const waitForAttach = true;

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer),
        ).debug.getRemoteLauncherCommand(debuggerHost, debuggerPort, waitForAttach);
        const expectedArgs = [
            debuggerPath.fileToCommandArgument(),
            '--listen',
            `${debuggerHost}:${debuggerPort}`,
            '--wait-for-client',
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debugger package path', async () => {
        const pkgPath = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer),
        ).debug.getDebuggerPackagePath();

        assert.strictEqual(pkgPath, debuggerPath);
    });
});
