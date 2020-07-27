// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Extension, Uri } from 'vscode';
import { NodeLanguageServerActivator } from '../../../client/activation/node/activator';
import { NodeLanguageServerManager } from '../../../client/activation/node/manager';
import { ILanguageServerManager } from '../../../client/activation/types';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IWorkspaceService
} from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PYLANCE_EXTENSION_ID } from '../../../client/common/constants';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, IExtensions, IPythonSettings } from '../../../client/common/types';
import { Common, Pylance } from '../../../client/common/utils/localize';

// tslint:disable:max-func-body-length

suite('Pylance Language Server - Activator', () => {
    let activator: NodeLanguageServerActivator;
    let workspaceService: IWorkspaceService;
    let manager: ILanguageServerManager;
    let fs: IFileSystem;
    let configuration: IConfigurationService;
    let settings: IPythonSettings;
    let extensions: IExtensions;
    let appShell: IApplicationShell;
    let appEnv: IApplicationEnvironment;
    let commands: ICommandManager;
    let extensionsChangedEvent: EventEmitter<void>;

    // tslint:disable-next-line: no-any
    let pylanceExtension: Extension<any>;
    setup(() => {
        manager = mock(NodeLanguageServerManager);
        workspaceService = mock(WorkspaceService);
        fs = mock(FileSystem);
        configuration = mock(ConfigurationService);
        settings = mock(PythonSettings);
        extensions = mock<IExtensions>();
        appShell = mock<IApplicationShell>();
        appEnv = mock<IApplicationEnvironment>();
        commands = mock<ICommandManager>();

        // tslint:disable-next-line: no-any
        pylanceExtension = mock<Extension<any>>();
        when(configuration.getSettings(anything())).thenReturn(instance(settings));
        when(appEnv.uriScheme).thenReturn('scheme');

        extensionsChangedEvent = new EventEmitter<void>();
        when(extensions.onDidChange).thenReturn(extensionsChangedEvent.event);

        activator = new NodeLanguageServerActivator(
            instance(manager),
            instance(workspaceService),
            instance(fs),
            instance(configuration),
            instance(extensions),
            instance(appShell),
            instance(appEnv),
            instance(commands)
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

    test('If Pylance is not installed, user should get prompt to install it', async () => {
        expect(activator.start(undefined))
            .to.eventually.be.rejectedWith(Pylance.pylanceNotInstalledMessage())
            .and.be.an.instanceOf(Error);
        verify(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).once();
    });

    test('If Pylance is installed, user should not get prompt to install it', async () => {
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(pylanceExtension));
        await activator.start(undefined);
        verify(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).never();
    });

    test('If Pylance is not installed and user responded Yes, Pylance install page should be opened', async () => {
        when(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).thenReturn(Promise.resolve(Common.bannerLabelYes()));

        try {
            await activator.start(undefined);
            // tslint:disable-next-line: no-empty
        } catch {}
        verify(appShell.openUrl(`scheme:extension/${PYLANCE_EXTENSION_ID}`)).once();
        verify(manager.connect()).never();
    });

    test('If Pylance is not installed and user responded Yes, Pylance activator should throw', async () => {
        when(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).thenReturn(Promise.resolve(Common.bannerLabelYes()));

        expect(activator.start(undefined))
            .to.eventually.be.rejectedWith(Pylance.pylanceNotInstalledMessage())
            .and.be.an.instanceOf(Error);

        extensionsChangedEvent.fire();
        verify(manager.connect()).never();
    });

    test('If Pylance is not installed and user responded Yes, reload should be called after installation', async () => {
        when(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).thenReturn(Promise.resolve(Common.bannerLabelYes()));

        try {
            await activator.start(undefined);
            // tslint:disable-next-line: no-empty
        } catch {}
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(pylanceExtension);
        extensionsChangedEvent.fire();
        verify(commands.executeCommand('workbench.action.reloadWindow')).once();
    });

    test('If Pylance is not installed and user responded No, Pylance install page should not be opened', async () => {
        when(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).thenReturn(Promise.resolve(Common.bannerLabelNo()));

        try {
            await activator.start(undefined);
            // tslint:disable-next-line: no-empty
        } catch {}
        verify(appShell.openUrl(anyString())).never();
        verify(manager.connect()).never();
    });

    test('If Pylance is not installed and user responded No, Pylance activator should throw', async () => {
        when(
            appShell.showErrorMessage(Pylance.installPylanceMessage(), Common.bannerLabelYes(), Common.bannerLabelNo())
        ).thenReturn(Promise.resolve(Common.bannerLabelNo()));

        expect(activator.start(undefined))
            .to.eventually.be.rejectedWith(Pylance.pylanceNotInstalledMessage())
            .and.be.an.instanceOf(Error);
        verify(manager.connect()).never();
    });

    test('Server should be disconnected but be started', async () => {
        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(pylanceExtension));
        await activator.start(undefined);

        verify(manager.start(undefined, undefined)).once();
        verify(manager.connect()).never();
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
