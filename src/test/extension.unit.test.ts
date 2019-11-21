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
import { ConfigurationService } from '../client/common/configuration/service';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { ExperimentsManager } from '../client/common/experiments';
import { IConfigurationService, IExperimentsManager, IPythonSettings } from '../client/common/types';
import { DebugAdapterDescriptorFactory } from '../client/debugger/extension/adapter/factory';
import { IDebugAdapterDescriptorFactory } from '../client/debugger/extension/types';

suite('Extension API Debugger', () => {
    const expectedLauncherPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;
    const ptvsdPath = path.join('path', 'to', 'ptvsd');

    let experimentsManager: IExperimentsManager;
    let debugAdapterFactory: IDebugAdapterDescriptorFactory;
    let configurationService: IConfigurationService;

    setup(() => {
        experimentsManager = mock(ExperimentsManager);
        debugAdapterFactory = mock(DebugAdapterDescriptorFactory);
        configurationService = mock(ConfigurationService);
    });

    function mockInExperiment() {
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);
        when(debugAdapterFactory.useNewPtvsd(anyString())).thenResolve(true);
        when(debugAdapterFactory.getPtvsdPath()).thenReturn(ptvsdPath);
        when(configurationService.getSettings(undefined)).thenReturn(({ pythonPath: 'python' } as any) as IPythonSettings);
    }

    function mockNotInExperiment() {
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);
        when(debugAdapterFactory.useNewPtvsd(anyString())).thenResolve(false);
    }

    test('Test debug launcher args (no-wait and not in experiment)', async () => {
        mockNotInExperiment();

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory), instance(configurationService)).debug.getRemoteLauncherCommand(
            'something',
            1234,
            false
        );
        const expectedArgs = [expectedLauncherPath, '--default', '--host', 'something', '--port', '1234'];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (no-wait and in experiment)', async () => {
        mockInExperiment();
        when(debugAdapterFactory.getRemotePtvsdArgs(anything())).thenReturn(['--host', 'something', '--port', '1234']);

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory), instance(configurationService)).debug.getRemoteLauncherCommand(
            'something',
            1234,
            false
        );
        const expectedArgs = [ptvsdPath, '--host', 'something', '--port', '1234'];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and not in experiment)', async () => {
        mockNotInExperiment();

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory), instance(configurationService)).debug.getRemoteLauncherCommand(
            'something',
            1234,
            true
        );
        const expectedArgs = [expectedLauncherPath, '--default', '--host', 'something', '--port', '1234', '--wait'];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and in experiment)', async () => {
        mockInExperiment();
        when(debugAdapterFactory.getRemotePtvsdArgs(anything())).thenReturn(['--host', 'something', '--port', '1234', '--wait']);

        const args = await buildApi(Promise.resolve(), instance(experimentsManager), instance(debugAdapterFactory), instance(configurationService)).debug.getRemoteLauncherCommand(
            'something',
            1234,
            true
        );
        const expectedArgs = [ptvsdPath, '--host', 'something', '--port', '1234', '--wait'];

        expect(args).to.be.deep.equal(expectedArgs);
    });
});

suite('Extension version tests', () => {
    let version: string;
    let applicationEnvironment: IApplicationEnvironment;
    const branchName = process.env.CI_BRANCH_NAME;

    suiteSetup(async function () {
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

    test('If we are running a pipeline in the master branch, the extension version in `package.json` should have the "-dev" suffix', async function () {
        if (branchName !== 'master') {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the master branch, the extension version in package.json should have the -dev suffix').to.be.true;
    });

    test('If we are running a pipeline in the release branch, the extension version in `package.json` should not have the "-dev" suffix', async function () {
        if (!branchName!.startsWith('release')) {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
        }

        return expect(version.endsWith('-dev'), 'When running a pipeline in the release branch, the extension version in package.json should not have the -dev suffix').to.be.false;
    });
});
