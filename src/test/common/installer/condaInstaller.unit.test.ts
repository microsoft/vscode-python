// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { CondaInstaller } from '../../../client/common/installer/condaInstaller';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { ICondaService } from '../../../client/interpreter/contracts';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Common - Conda Installer', () => {
    let installer: CondaInstaller;
    let serviceContainer: IServiceContainer;
    let condaService: ICondaService;
    let configService: IConfigurationService;
    setup(() => {
        serviceContainer = mock(ServiceContainer);
        condaService = mock(CondaService);
        configService = mock(ConfigurationService);
        when(serviceContainer.get<ICondaService>(ICondaService)).thenReturn(instance(condaService));
        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
        installer = new CondaInstaller(instance(serviceContainer));
    });
    test('Name and priority', async () => {
        assert.equal(installer.displayName, 'Conda');
        assert.equal(installer.name, 'Conda');
        assert.equal(installer.priority, 0);
    });
    test('Installer is not supported when conda is available variable is set to false', async () => {
        const uri = Uri.file(__filename);
        installer._isCondaAvailable = false;

        const supported = await installer.isSupported(uri);

        assert.equal(supported, false);
    });
    test('Installer is not supported when conda is not available', async () => {
        const uri = Uri.file(__filename);
        when(condaService.isCondaAvailable()).thenResolve(false);

        const supported = await installer.isSupported(uri);

        assert.equal(supported, false);
    });
    test('Installer is not supported when current env is not a conda env', async () => {
        const uri = Uri.file(__filename);
        const settings: IPythonSettings = mock(PythonSettings);
        const pythonPath = 'my py path';

        when(settings.pythonPath).thenReturn(pythonPath);
        when(condaService.isCondaAvailable()).thenResolve(true);
        when(configService.getSettings(uri)).thenReturn(instance(settings));
        when(condaService.isCondaEnvironment(pythonPath)).thenResolve(false);

        const supported = await installer.isSupported(uri);

        assert.equal(supported, false);
    });
    test('Installer is supported when current env is a conda env', async () => {
        const uri = Uri.file(__filename);
        const settings: IPythonSettings = mock(PythonSettings);
        const pythonPath = 'my py path';

        when(settings.pythonPath).thenReturn(pythonPath);
        when(condaService.isCondaAvailable()).thenResolve(true);
        when(configService.getSettings(uri)).thenReturn(instance(settings));
        when(condaService.isCondaEnvironment(pythonPath)).thenResolve(true);

        const supported = await installer.isSupported(uri);

        assert.equal(supported, true);
    });
});
