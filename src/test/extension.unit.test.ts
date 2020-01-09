// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as path from 'path';
import { anyString, anything, instance, mock, when } from 'ts-mockito';
import { buildApi } from '../client/api';
import { ApplicationEnvironment } from '../client/common/application/applicationEnvironment';
import { IApplicationEnvironment } from '../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { ExperimentsManager } from '../client/common/experiments';
import { IExperimentsManager } from '../client/common/types';
import { DebugAdapterDescriptorFactory } from '../client/debugger/extension/adapter/factory';
import { IDebugAdapterDescriptorFactory } from '../client/debugger/extension/types';

// tslint:disable-next-line: max-func-body-length
suite('Extension API Debugger', () => {
    const expectedLauncherPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;
    const ptvsdPath = path.join('path', 'to', 'ptvsd');
    const ptvsdHost = 'somehost';
    const ptvsdPort = 12345;

    let experimentsManager: IExperimentsManager;
    let debugAdapterFactory: IDebugAdapterDescriptorFactory;

    setup(() => {
        experimentsManager = mock(ExperimentsManager);
        debugAdapterFactory = mock(DebugAdapterDescriptorFactory);
    });

    function mockInExperiment(host: string, port: number, wait: boolean) {
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);
        when(debugAdapterFactory.useNewPtvsd(anyString())).thenResolve(true);
        when(debugAdapterFactory.getPtvsdPath()).thenReturn(ptvsdPath);
        if (wait) {
            when(debugAdapterFactory.getRemotePtvsdArgs(anything())).thenReturn(['--host', host, '--port', port.toString(), '--wait']);
        } else {
            when(debugAdapterFactory.getRemotePtvsdArgs(anything())).thenReturn(['--host', host, '--port', port.toString()]);
        }
    }

    function mockNotInExperiment(host: string, port: number, wait: boolean) {
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);
        when(debugAdapterFactory.useNewPtvsd(anyString())).thenResolve(false);
        if (wait) {
            when(debugAdapterFactory.getRemotePtvsdArgs(anything())).thenReturn(['--default', '--host', host, '--port', port.toString(), '--wait']);
        } else {
            when(debugAdapterFactory.getRemotePtvsdArgs(anything())).thenReturn(['--default', '--host', host, '--port', port.toString()]);
        }
    }

    test('Test debug launcher args (no-wait and not in experiment)', async () => {
        const waitForAttach = false;
        mockNotInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [expectedLauncherPath, '--default', '--host', ptvsdHost, '--port', ptvsdPort.toString()];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (no-wait and in experiment)', async () => {
        const waitForAttach = false;
        mockInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [ptvsdPath, '--host', ptvsdHost, '--port', ptvsdPort.toString()];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and not in experiment)', async () => {
        const waitForAttach = true;
        mockNotInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [expectedLauncherPath, '--default', '--host', ptvsdHost, '--port', ptvsdPort.toString(), '--wait'];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and in experiment)', async () => {
        const waitForAttach = true;
        mockInExperiment(ptvsdHost, ptvsdPort, waitForAttach);

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory)).debug.getRemoteLauncherCommand(
            ptvsdHost,
            ptvsdPort,
            waitForAttach
        );
        const expectedArgs = [ptvsdPath, '--host', ptvsdHost, '--port', ptvsdPort.toString(), '--wait'];

        expect(args).to.be.deep.equal(expectedArgs);
    });
});

suite('Extension version tests', () => {
    let version: string;
    let applicationEnvironment: IApplicationEnvironment;
    const branchName = process.env.CI_BRANCH_NAME;

    suiteSetup(async function() {
        // Skip the entire suite if running locally
        if (!branchName) {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }
    });

    setup(() => {
        applicationEnvironment = new ApplicationEnvironment(undefined as any, undefined as any, undefined as any);
        version = applicationEnvironment.packageJson.version;
    });

    test('If we are running a pipeline in the master branch, the extension version in `package.json` should have the "-dev" suffix', async function() {
        if (branchName !== 'master') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the master branch, the extension version in package.json should have the -dev suffix').to.be.true;
    });

    test('If we are running a pipeline in the release branch, the extension version in `package.json` should not have the "-dev" suffix', async function() {
        if (!branchName!.startsWith('release')) {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the release branch, the extension version in package.json should not have the -dev suffix').to.be.false;
    });
});
