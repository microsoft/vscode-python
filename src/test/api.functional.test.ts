// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { anyString, anything, instance, mock, when } from 'ts-mockito';
import { buildApi } from '../client/api';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { ExperimentsManager } from '../client/common/experiments';
import { IExperimentsManager } from '../client/common/types';
import { DebugAdapterDescriptorFactory } from '../client/debugger/extension/adapter/factory';
import { IDebugAdapterDescriptorFactory } from '../client/debugger/extension/types';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';

suite('Extension API - Debugger', () => {
    const expectedLauncherPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;
    const ptvsdPath = path.join('path', 'to', 'ptvsd');
    const ptvsdHost = 'somehost';
    const ptvsdPort = 12345;

    let serviceManager: IServiceManager;
    let serviceContainer: IServiceContainer;
    let experimentsManager: IExperimentsManager;
    let debugAdapterFactory: IDebugAdapterDescriptorFactory;

    setup(() => {
        serviceManager = mock(ServiceManager);
        serviceContainer = mock(ServiceContainer);
        experimentsManager = mock(ExperimentsManager);
        debugAdapterFactory = mock(DebugAdapterDescriptorFactory);

        when(serviceContainer.get<IExperimentsManager>(IExperimentsManager))
            // Return the mock.
            .thenReturn(instance(experimentsManager));
        when(serviceContainer.get<IDebugAdapterDescriptorFactory>(IDebugAdapterDescriptorFactory))
            // Return the mock.
            .thenReturn(instance(debugAdapterFactory));
    });

    function mockInExperiment(host: string, port: number, wait: boolean) {
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);
        when(debugAdapterFactory.useNewDebugger(anyString())).thenResolve(true);
        when(debugAdapterFactory.getDebuggerPath()).thenReturn(ptvsdPath);
        if (wait) {
            when(debugAdapterFactory.getRemoteDebuggerArgs(anything())).thenReturn([
                '--host',
                host,
                '--port',
                port.toString(),
                '--wait',
            ]);
        } else {
            when(debugAdapterFactory.getRemoteDebuggerArgs(anything())).thenReturn([
                '--host',
                host,
                '--port',
                port.toString(),
            ]);
        }
    }

    function mockNotInExperiment(host: string, port: number, wait: boolean) {
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);
        when(debugAdapterFactory.useNewDebugger(anyString())).thenResolve(false);
        if (wait) {
            when(debugAdapterFactory.getRemoteDebuggerArgs(anything())).thenReturn([
                '--default',
                '--host',
                host,
                '--port',
                port.toString(),
                '--wait',
            ]);
        } else {
            when(debugAdapterFactory.getRemoteDebuggerArgs(anything())).thenReturn([
                '--default',
                '--host',
                host,
                '--port',
                port.toString(),
            ]);
        }
    }

    test('Test debug launcher args (no-wait and not in experiment)', async () => {
        const waitForAttach = false;
        mockNotInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [expectedLauncherPath, '--default', '--host', ptvsdHost, '--port', ptvsdPort.toString()];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (no-wait and in experiment)', async () => {
        const waitForAttach = false;
        mockInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [ptvsdPath, '--host', ptvsdHost, '--port', ptvsdPort.toString()];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and not in experiment)', async () => {
        const waitForAttach = true;
        mockNotInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [
            expectedLauncherPath,
            '--default',
            '--host',
            ptvsdHost,
            '--port',
            ptvsdPort.toString(),
            '--wait',
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and in experiment)', async () => {
        const waitForAttach = true;
        mockInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [ptvsdPath, '--host', ptvsdHost, '--port', ptvsdPort.toString(), '--wait'];

        expect(args).to.be.deep.equal(expectedArgs);
    });
});
