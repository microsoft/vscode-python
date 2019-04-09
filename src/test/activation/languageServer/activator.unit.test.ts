// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { LanguageServerExtensionActivator } from '../../../client/activation/languageServer/activator';
import { LanguageServerDownloader } from '../../../client/activation/languageServer/downloader';
import { LanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import { LanguageServerManager } from '../../../client/activation/languageServer/manager';
import {
    ILanguageServerActivator,
    ILanguageServerDownloader,
    ILanguageServerFolderService,
    ILanguageServerManager
} from '../../../client/activation/types';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { createDeferred } from '../../../client/common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { sleep } from '../../core';

// tslint:disable:max-func-body-length

suite('Language Server - Activator', () => {
    let activator: ILanguageServerActivator;
    let workspaceService: IWorkspaceService;
    let manager: ILanguageServerManager;
    let fs: IFileSystem;
    let lsDownloader: ILanguageServerDownloader;
    let lsFolderService: ILanguageServerFolderService;
    let configuration: IConfigurationService;
    let settings: IPythonSettings;
    setup(() => {
        manager = mock(LanguageServerManager);
        workspaceService = mock(WorkspaceService);
        fs = mock(FileSystem);
        lsDownloader = mock(LanguageServerDownloader);
        lsFolderService = mock(LanguageServerFolderService);
        configuration = mock(ConfigurationService);
        settings = mock(PythonSettings);
        when(configuration.getSettings(anything())).thenReturn(instance(settings));
        activator = new LanguageServerExtensionActivator(
            instance(manager),
            instance(workspaceService),
            instance(fs),
            instance(lsDownloader),
            instance(lsFolderService),
            instance(configuration)
        );
    });
    test('Manager must be started without any workspace', async () => {
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(false);

        await activator.activate(undefined);

        verify(manager.start(undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
    });
    test('Manager must be disposed', async () => {
        activator.dispose();

        verify(manager.dispose()).once();
    });
    test('Do not download LS if not required', async () => {
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(false);

        await activator.activate(undefined);

        verify(manager.start(undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(lsFolderService.getLanguageServerFolderName(anything())).never();
        verify(lsDownloader.downloadLanguageServer(anything(), anything())).never();
    });
    test('Do not download LS if not required', async () => {
        const languageServerFolder = 'Some folder name';
        const languageServerFolderPath = path.join(EXTENSION_ROOT_DIR, languageServerFolder);
        const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll');

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(true);
        when(lsFolderService.getLanguageServerFolderName(anything()))
            .thenResolve(languageServerFolder);
        when(fs.fileExists(mscorlib)).thenResolve(true);

        await activator.activate(undefined);

        verify(manager.start(undefined)).once();
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
        when(manager.start(undefined)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(true);
        when(lsFolderService.getLanguageServerFolderName(anything()))
            .thenResolve(languageServerFolder);
        when(fs.fileExists(mscorlib)).thenResolve(false);
        when(lsDownloader.downloadLanguageServer(languageServerFolderPath, undefined))
            .thenReturn(deferred.promise);

        const promise = activator.activate(undefined);
        await sleep(1);
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(lsFolderService.getLanguageServerFolderName(anything())).once();
        verify(lsDownloader.downloadLanguageServer(anything(), undefined)).once();

        verify(manager.start(undefined)).never();

        deferred.resolve();
        await sleep(1);
        verify(manager.start(undefined)).once();

        await promise;
    });
    test('Manager must be started with resource for first available workspace', async () => {
        const uri = Uri.file(__filename);
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([{ index: 0, name: '', uri }]);
        when(manager.start(uri)).thenResolve();
        when(settings.downloadLanguageServer).thenReturn(false);

        await activator.activate(undefined);

        verify(manager.start(uri)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(workspaceService.workspaceFolders).once();
    });

    test('Manager must be disposed', async () => {
        activator.dispose();

        verify(manager.dispose()).once();
    });
});
