// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { anyString, instance, mock, when } from 'ts-mockito';
import { buildApi } from '../client/api';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { ExperimentsManager } from '../client/common/experiments';
import { IExperimentsManager } from '../client/common/types';
import { ServiceContainer } from '../client/ioc/container';
import { IServiceContainer } from '../client/ioc/types';

suite('Extension API - Debugger', () => {
    const expectedLauncherPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;
    const ptvsdPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy', 'no_wheels', 'debugpy');
    const ptvsdHost = 'somehost';
    const ptvsdPort = 12345;

    let serviceContainer: IServiceContainer;
    let experimentsManager: IExperimentsManager;

    setup(() => {
        serviceContainer = mock(ServiceContainer);
        experimentsManager = mock(ExperimentsManager);

        when(serviceContainer.get<IExperimentsManager>(IExperimentsManager)).thenReturn(instance(experimentsManager));
    });

    test('Test debug launcher args (no-wait and not in experiment)', async () => {
        const waitForAttach = false;
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);

        const args = await buildApi(Promise.resolve(), instance(serviceContainer)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [expectedLauncherPath, '--default', '--host', ptvsdHost, '--port', ptvsdPort.toString()];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (no-wait and in experiment)', async () => {
        const waitForAttach = false;
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);

        const args = await buildApi(Promise.resolve(), instance(serviceContainer)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [ptvsdPath.fileToCommandArgument(), '--listen', `${ptvsdHost}:${ptvsdPort}`];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and not in experiment)', async () => {
        const waitForAttach = true;
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);

        const args = await buildApi(Promise.resolve(), instance(serviceContainer)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [
            expectedLauncherPath,
            '--default',
            '--host',
            ptvsdHost,
            '--port',
            ptvsdPort.toString(),
            '--wait'
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and in experiment)', async () => {
        const waitForAttach = true;
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);

        const args = await buildApi(Promise.resolve(), instance(serviceContainer)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [
            ptvsdPath.fileToCommandArgument(),
            '--listen',
            `${ptvsdHost}:${ptvsdPort}`,
            '--wait-for-client'
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });
});
