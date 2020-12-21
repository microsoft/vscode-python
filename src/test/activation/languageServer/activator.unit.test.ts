// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { DotNetLanguageServerActivator } from '../../../client/activation/languageServer/activator';
import { DotNetLanguageServerManager } from '../../../client/activation/languageServer/manager';
import {
    ILanguageServerDownloader,
    ILanguageServerFolderService,
    ILanguageServerManager,
} from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, IPythonExtensionBanner, IPythonSettings } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { sleep } from '../../core';

// tslint:disable:max-func-body-length

suite('Microsoft Language Server - Activator', () => {
    let activator: DotNetLanguageServerActivator;
    let workspaceService: IWorkspaceService;
    let manager: ILanguageServerManager;
    let fs: IFileSystem;
    let lsDownloader: ILanguageServerDownloader;
    let lsFolderService: ILanguageServerFolderService;
    let configuration: IConfigurationService;
    let settings: IPythonSettings;
    let banner: IPythonExtensionBanner;
    setup(() => {
        manager = mock(DotNetLanguageServerManager);
        workspaceService = mock<IWorkspaceService>();
        fs = mock<IFileSystem>();
        lsDownloader = mock<ILanguageServerDownloader>();
        lsFolderService = mock<ILanguageServerFolderService>();
        configuration = mock<IConfigurationService>();
        settings = mock<IPythonSettings>();
        banner = mock<IPythonExtensionBanner>();
        when(configuration.getSettings(anything())).thenReturn(instance(settings));
        activator = new DotNetLanguageServerActivator(
            instance(manager),
            instance(workspaceService),
            instance(fs),
            instance(lsDownloader),
            instance(lsFolderService),
            instance(configuration),
            instance(banner),
        );
    });
    test('Manager must be started without any workspace', async () => {
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined, undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(false);

        await activator.start(undefined);

        verify(manager.start(undefined, undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
    });
    test('Manager must be disposed', async () => {
        activator.dispose();
        verify(manager.dispose()).once();
    });
    test('Server should be disconnected but be started', async () => {
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        await activator.start(undefined);

        verify(manager.start(undefined, undefined)).once();
        verify(manager.connect()).never();
    });
    test('Do not download LS if not required', async () => {
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined, undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(false);

        await activator.start(undefined);

        verify(manager.start(undefined, undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(lsFolderService.getLanguageServerFolderName(anything())).never();
        verify(lsDownloader.downloadLanguageServer(anything(), anything())).never();
    });
    test('Do not download LS if not required', async () => {
        const languageServerFolder = 'Some folder name';
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined, undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(true);
        when(lsFolderService.getLanguageServerFolderName(anything())).thenResolve(languageServerFolder);
        when(fs.fileExists(mscorlib)).thenResolve(true);

        await activator.start(undefined);

        verify(manager.start(undefined, undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(lsFolderService.getLanguageServerFolderName(anything())).once();
        verify(lsDownloader.downloadLanguageServer(anything(), anything())).never();
    });
    test('Start language server after downloading', async () => {
        const deferred = createDeferred<void>();
        const languageServerFolder = 'Some folder name';
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined, undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(true);
        when(lsFolderService.getLanguageServerFolderName(anything())).thenResolve(languageServerFolder);
        when(fs.fileExists(mscorlib)).thenResolve(false);
        when(lsDownloader.downloadLanguageServer(languageServerFolderPath, undefined)).thenReturn(deferred.promise);

        const promise = activator.start(undefined);
        await sleep(1);
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(lsFolderService.getLanguageServerFolderName(anything())).once();
        verify(lsDownloader.downloadLanguageServer(anything(), undefined)).once();

        verify(manager.start(undefined, undefined)).never();

        deferred.resolve();
        await sleep(1);
        verify(manager.start(undefined, undefined)).once();

        await promise;
    });
    test('Manager must be started with resource for first available workspace', async () => {
        const uri = Uri.file(__filename);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([{ index: 0, name: '', uri }]);
        when(manager.start(uri, undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(false);

        await activator.start(undefined);

        verify(manager.start(uri, undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(workspaceService.workspaceFolders).once();
    });

    test('Download and check if ICU config exists', async () => {
        const languageServerFolder = 'Some folder name';
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');
        const targetJsonFile = path.join(
            languageServerFolderPath,
            'Microsoft.Python.LanguageServer.runtimeconfig.json',
        );

        when(settings.downloadLanguageServer).thenReturn(true);
        when(lsFolderService.getLanguageServerFolderName(undefined)).thenResolve(languageServerFolder);
        when(fs.fileExists(mscorlib)).thenResolve(false);
        when(lsDownloader.downloadLanguageServer(languageServerFolderPath, undefined)).thenResolve();
        when(fs.fileExists(targetJsonFile)).thenResolve(false);

        await activator.ensureLanguageServerIsAvailable(undefined);

        verify(lsFolderService.getLanguageServerFolderName(undefined)).once();
        verify(lsDownloader.downloadLanguageServer(anything(), undefined)).once();
        verify(fs.fileExists(targetJsonFile)).once();
    });
    test('Download if contents of ICU config is not as expected', async () => {
        const languageServerFolder = 'Some folder name';
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');
        const targetJsonFile = path.join(
            languageServerFolderPath,
            'Microsoft.Python.LanguageServer.runtimeconfig.json',
        );
        const jsonContents = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': false } } };

        when(settings.downloadLanguageServer).thenReturn(true);
        when(lsFolderService.getLanguageServerFolderName(undefined)).thenResolve(languageServerFolder);
        when(fs.fileExists(mscorlib)).thenResolve(false);
        when(lsDownloader.downloadLanguageServer(languageServerFolderPath, undefined)).thenResolve();
        when(fs.fileExists(targetJsonFile)).thenResolve(true);
        when(fs.readFile(targetJsonFile)).thenResolve(JSON.stringify(jsonContents));

        await activator.ensureLanguageServerIsAvailable(undefined);

        verify(lsFolderService.getLanguageServerFolderName(undefined)).once();
        verify(lsDownloader.downloadLanguageServer(anything(), undefined)).once();
        verify(fs.fileExists(targetJsonFile)).once();
        verify(fs.readFile(targetJsonFile)).once();
    });
    test('JSON file is created to ensure LS can start without ICU', async () => {
        const targetJsonFile = path.join('some folder', 'Microsoft.Python.LanguageServer.runtimeconfig.json');
        const contents = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': true } } };
        when(fs.fileExists(targetJsonFile)).thenResolve(false);
        when(fs.writeFile(targetJsonFile, JSON.stringify(contents))).thenResolve();

        await activator.prepareLanguageServerForNoICU('some folder');

        verify(fs.fileExists(targetJsonFile)).atLeast(1);
        verify(fs.writeFile(targetJsonFile, JSON.stringify(contents))).once();
    });
    test('JSON file is not created if it already exists with the right content', async () => {
        const targetJsonFile = path.join('some folder', 'Microsoft.Python.LanguageServer.runtimeconfig.json');
        const contents = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': true } } };
        const existingContents = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': true } } };
        when(fs.fileExists(targetJsonFile)).thenResolve(true);
        when(fs.readFile(targetJsonFile)).thenResolve(JSON.stringify(existingContents));

        await activator.prepareLanguageServerForNoICU('some folder');

        verify(fs.fileExists(targetJsonFile)).atLeast(1);
        verify(fs.writeFile(targetJsonFile, JSON.stringify(contents))).never();
        verify(fs.readFile(targetJsonFile)).once();
    });
    test('JSON file is created if it already exists but with the wrong file content', async () => {
        const targetJsonFile = path.join('some folder', 'Microsoft.Python.LanguageServer.runtimeconfig.json');
        const contents = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': true } } };
        const existingContents = { runtimeOptions: { configProperties: { 'System.Globalization.Invariant': false } } };
        when(fs.fileExists(targetJsonFile)).thenResolve(true);
        when(fs.readFile(targetJsonFile)).thenResolve(JSON.stringify(existingContents));

        await activator.prepareLanguageServerForNoICU('some folder');

        verify(fs.fileExists(targetJsonFile)).atLeast(1);
        verify(fs.writeFile(targetJsonFile, JSON.stringify(contents))).once();
        verify(fs.readFile(targetJsonFile)).once();
    });
});
