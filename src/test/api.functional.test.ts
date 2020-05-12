// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { assert, expect } from 'chai';
import * as path from 'path';
import { instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { buildApi } from '../client/api';
import { ConfigurationService } from '../client/common/configuration/service';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { IConfigurationService } from '../client/common/types';
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

    setup(() => {
        serviceContainer = mock(ServiceContainer);
        serviceManager = mock(ServiceManager);
        configurationService = mock(ConfigurationService);

        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
            instance(configurationService)
        );
    });

    test('Execution command settings API returns expected array if interpreter is set', async () => {
        const resource = Uri.parse('a');
        when(configurationService.getSettings(resource)).thenReturn({ pythonPath: 'settingValue' } as any);

        const interpreterPath = buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).settings.getExecutionCommand(resource);

        assert.deepEqual(interpreterPath, ['settingValue']);
    });

    test('Execution command settings API returns `undefined` if interpreter is set', async () => {
        const resource = Uri.parse('a');
        when(configurationService.getSettings(resource)).thenReturn({ pythonPath: '' } as any);

        const interpreterPath = buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).settings.getExecutionCommand(resource);

        expect(interpreterPath).to.equal(undefined, '');
    });

    test('Test debug launcher args (no-wait)', async () => {
        const waitForAttach = false;

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(debuggerHost, debuggerPort, waitForAttach);
        const expectedArgs = [debuggerPath.fileToCommandArgument(), '--listen', `${debuggerHost}:${debuggerPort}`];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait)', async () => {
        const waitForAttach = true;

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(debuggerHost, debuggerPort, waitForAttach);
        const expectedArgs = [
            debuggerPath.fileToCommandArgument(),
            '--listen',
            `${debuggerHost}:${debuggerPort}`,
            '--wait-for-client'
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debugger package path', async () => {
        const pkgPath = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getDebuggerPackagePath();

        assert.equal(pkgPath, debuggerPath);
    });
});
