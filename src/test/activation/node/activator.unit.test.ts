// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Extension, Uri } from 'vscode';
import { NodeLanguageServerActivator } from '../../../client/activation/node/activator';
import { NodeLanguageServerManager } from '../../../client/activation/node/manager';
import { ILanguageServerManager } from '../../../client/activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PYLANCE_EXTENSION_ID } from '../../../client/common/constants';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, IExtensions, IPythonSettings } from '../../../client/common/types';
import { Common, Pylance } from '../../../client/common/utils/localize';

suite('Pylance Language Server - Activator', () => {
    let activator: NodeLanguageServerActivator;
    let workspaceService: IWorkspaceService;
    let manager: ILanguageServerManager;
    let fs: IFileSystem;
    let configuration: IConfigurationService;
    let settings: IPythonSettings;
    let extensions: IExtensions;
    let appShell: IApplicationShell;
    let commandManager: ICommandManager;
    let extensionsChangedEvent: EventEmitter<void>;

    let pylanceExtension: Extension<any>;
    setup(() => {
        manager = mock(NodeLanguageServerManager);
        workspaceService = mock(WorkspaceService);
        fs = mock(FileSystem);
        configuration = mock(ConfigurationService);
        settings = mock(PythonSettings);
        extensions = mock<IExtensions>();
        appShell = mock<IApplicationShell>();
        commandManager = mock<ICommandManager>();

        pylanceExtension = mock<Extension<any>>();
        when(configuration.getSettings(anything())).thenReturn(instance(settings));

        extensionsChangedEvent = new EventEmitter<void>();
        when(extensions.onDidChange).thenReturn(extensionsChangedEvent.event);

        activator = new NodeLanguageServerActivator(
            instance(manager),
            instance(workspaceService),
            instance(fs),
            instance(configuration),
            instance(extensions),
            instance(appShell),
            instance(commandManager),
        );
    });
    teardown(() => {
        extensionsChangedEvent.dispose();
    });

    test('Manager must be started without any workspace', async () => {
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(pylanceExtension));
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(manager.start(undefined, undefined)).thenResolve();

        await activator.start(undefined);
        verify(manager.start(undefined, undefined)).once();
        verify(workspaceService.hasWorkspaceFolders).once();
    });

    test('Manager must be disposed', async () => {
        activator.dispose();
        verify(manager.dispose()).once();
    });

    test('Activator should check if Pylance is installed', async () => {
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(pylanceExtension));
        await activator.start(undefined);
        verify(extensions.getExtension(PYLANCE_EXTENSION_ID)).once();
    });

    test('Activator should not check if Pylance is installed in development mode', async () => {
        when(settings.downloadLanguageServer).thenReturn(false);
        await activator.start(undefined);
        verify(extensions.getExtension(PYLANCE_EXTENSION_ID)).never();
    });

    test('When Pylance is not installed activator should show install prompt ', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(Common.bannerLabelNo()));

        try {
            await activator.start(undefined);
        } catch {}
        verify(
            appShell.showWarningMessage(
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).once();
        verify(commandManager.executeCommand('extension.open', PYLANCE_EXTENSION_ID)).never();
    });

    test('When Pylance is not installed activator should open Pylance install page if users clicks Yes', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(Common.bannerLabelYes()));

        try {
            await activator.start(undefined);
        } catch {}
        verify(commandManager.executeCommand('extension.open', PYLANCE_EXTENSION_ID)).once();
    });

    test('Activator should throw if Pylance is not installed', async () => {
        expect(activator.start(undefined))
            .to.eventually.be.rejectedWith(Pylance.pylanceNotInstalledMessage())
            .and.be.an.instanceOf(Error);
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
});
