// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PoetryInstaller } from '../../../client/common/installer/poetryInstaller';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { ProcessService } from '../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { ExecutionInfo, IConfigurationService } from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';

// tslint:disable-next-line:max-func-body-length
suite('Module Installer - Poetry', () => {
    class TestInstaller extends PoetryInstaller {
        // tslint:disable-next-line:no-unnecessary-override
        public getExecutionInfo(moduleName: string, resource?: Uri): Promise<ExecutionInfo> {
            return super.getExecutionInfo(moduleName, resource);
        }
    }
    let poetryInstaller: TestInstaller;
    let workspaceService: IWorkspaceService;
    let configurationService: IConfigurationService;
    let fileSystem: IFileSystem;
    let processServiceFactory: IProcessServiceFactory;
    setup(() => {
        const serviceContainer = mock(ServiceContainer);
        workspaceService = mock(WorkspaceService);
        configurationService = mock(ConfigurationService);
        fileSystem = mock(FileSystem);
        processServiceFactory = mock(ProcessServiceFactory);

        poetryInstaller = new TestInstaller(
            instance(serviceContainer),
            instance(workspaceService),
            instance(configurationService),
            instance(fileSystem),
            instance(processServiceFactory),
        );
    });

    test('Installer name is poetry', () => {
        expect(poetryInstaller.name).to.equal('poetry');
    });

    test('Installer priority is 10', () => {
        expect(poetryInstaller.priority).to.equal(10);
    });

    test('Installer display name is poetry', () => {
        expect(poetryInstaller.displayName).to.equal('poetry');
    });

    test('Is not supported when there is no resource', async () => {
        const supported = await poetryInstaller.isSupported();
        assert.equal(supported, false);
    });
    test('Is not supported when there is no workspace', async () => {
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn();

        const supported = await poetryInstaller.isSupported(Uri.file(__filename));

        assert.equal(supported, false);
    });
    test('Is not supported when the poetry file does not exists', async () => {
        const uri = Uri.file(__dirname);
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn({ uri, name: '', index: 0 });
        when(fileSystem.fileExists(anything())).thenResolve(false);

        const supported = await poetryInstaller.isSupported(Uri.file(__filename));

        assert.equal(supported, false);
    });
    test('Is not supported when the poetry is not available (with stderr)', async () => {
        const uri = Uri.file(__dirname);
        const processService = mock(ProcessService);
        const settings = mock(PythonSettings);

        when(configurationService.getSettings(anything())).thenReturn(instance(settings));
        when(settings.poetryPath).thenReturn('poetry');
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn({ uri, name: '', index: 0 });
        when(fileSystem.fileExists(anything())).thenResolve(true);
        when(processServiceFactory.create(anything())).thenResolve(instance(processService));
        when(processService.exec(anything(), anything(), anything())).thenResolve({ stderr: 'Kaboom', stdout: '' });

        const supported = await poetryInstaller.isSupported(Uri.file(__filename));

        assert.equal(supported, false);
    });
    test('Is not supported when the poetry is not available (with error running poetry)', async () => {
        const uri = Uri.file(__dirname);
        const processService = mock(ProcessService);
        const settings = mock(PythonSettings);

        when(configurationService.getSettings(anything())).thenReturn(instance(settings));
        when(settings.poetryPath).thenReturn('poetry');
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn({ uri, name: '', index: 0 });
        when(fileSystem.fileExists(anything())).thenResolve(true);
        when(processServiceFactory.create(anything())).thenResolve(instance(processService));
        when(processService.exec(anything(), anything(), anything())).thenReject(new Error('Kaboom'));

        const supported = await poetryInstaller.isSupported(Uri.file(__filename));

        assert.equal(supported, false);
    });
    test('Is supported', async () => {
        const uri = Uri.file(__dirname);
        const processService = mock(ProcessService);
        const settings = mock(PythonSettings);

        when(configurationService.getSettings(uri)).thenReturn(instance(settings));
        when(settings.poetryPath).thenReturn('poetry path');
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn({ uri, name: '', index: 0 });
        when(fileSystem.fileExists(anything())).thenResolve(true);
        when(processServiceFactory.create(uri)).thenResolve(instance(processService));
        when(processService.exec('poetry path', anything(), anything())).thenResolve({ stderr: '', stdout: '' });

        const supported = await poetryInstaller.isSupported(Uri.file(__filename));

        assert.equal(supported, true);
    });
    test('Get Executable info', async () => {
        const uri = Uri.file(__dirname);
        const settings = mock(PythonSettings);

        when(configurationService.getSettings(uri)).thenReturn(instance(settings));
        when(settings.poetryPath).thenReturn('poetry path');

        const info = await poetryInstaller.getExecutionInfo('something', uri);

        assert.deepEqual(info, { args: ['add', '--dev', 'something'], execPath: 'poetry path' });
    });
    test('Get executable info when installing black', async () => {
        const uri = Uri.file(__dirname);
        const settings = mock(PythonSettings);

        when(configurationService.getSettings(uri)).thenReturn(instance(settings));
        when(settings.poetryPath).thenReturn('poetry path');

        const info = await poetryInstaller.getExecutionInfo('black', uri);

        assert.deepEqual(info, { args: ['add', '--dev', 'black', '--allow-prereleases'], execPath: 'poetry path' });
    });
});
