// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anyString, instance, mock, verify, when, anything } from 'ts-mockito';
import { ConfigurationTarget, EventEmitter, Extension, WorkspaceConfiguration } from 'vscode';
import { LanguageServerChangeHandler } from '../../../client/activation/common/languageServerChangeHandler';
import { LanguageServerType } from '../../../client/activation/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../client/common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../../client/common/constants';
import { IConfigurationService, IExtensions } from '../../../client/common/types';
import { Common, LanguageService, Pylance } from '../../../client/common/utils/localize';

suite('Language Server - Change Handler', () => {
    let extensions: IExtensions;
    let appShell: IApplicationShell;
    let commands: ICommandManager;
    let extensionsChangedEvent: EventEmitter<void>;
    let handler: LanguageServerChangeHandler;

    let workspace: IWorkspaceService;
    let configService: IConfigurationService;

    let pylanceExtension: Extension<any>;
    setup(() => {
        extensions = mock<IExtensions>();
        appShell = mock<IApplicationShell>();
        commands = mock<ICommandManager>();
        workspace = mock<IWorkspaceService>();
        configService = mock<IConfigurationService>();

        pylanceExtension = mock<Extension<any>>();

        extensionsChangedEvent = new EventEmitter<void>();
        when(extensions.onDidChange).thenReturn(extensionsChangedEvent.event);
    });
    teardown(() => {
        extensionsChangedEvent.dispose();
        handler?.dispose();
    });

    [undefined, LanguageServerType.None, LanguageServerType.Jedi, LanguageServerType.Node].forEach(async (t) => {
        test(`Handler should do nothing if language server is ${t} and did not change`, async () => {
            handler = makeHandler(t);
            await handler.handleLanguageServerChange(t);

            verify(extensions.getExtension(anyString())).once();
            verify(appShell.showInformationMessage(anyString(), anyString())).never();
            verify(appShell.showWarningMessage(anyString(), anyString())).never();
            verify(commands.executeCommand(anyString())).never();
        });
    });

    [LanguageServerType.None, LanguageServerType.Jedi, LanguageServerType.Node].forEach(async (t) => {
        test(`Handler should prompt for reload when language server type changes to ${t}, Pylance is installed ans user clicks Reload`, async () => {
            when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(pylanceExtension));
            when(
                appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
            ).thenReturn(Promise.resolve(Common.reload()));

            handler = makeHandler(undefined);
            await handler.handleLanguageServerChange(t);

            verify(
                appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
            ).once();
            verify(commands.executeCommand('workbench.action.reloadWindow')).once();
        });
    });

    [LanguageServerType.None, LanguageServerType.Jedi, LanguageServerType.Node].forEach(async (t) => {
        test(`Handler should not prompt for reload when language server type changes to ${t}, Pylance is installed ans user does not clicks Reload`, async () => {
            when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(instance(pylanceExtension));
            when(
                appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
            ).thenReturn(Promise.resolve(undefined));

            handler = makeHandler(undefined);
            await handler.handleLanguageServerChange(t);

            verify(
                appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
            ).once();
            verify(commands.executeCommand('workbench.action.reloadWindow')).never();
        });
    });

    test('Handler should prompt for install when language server changes to Pylance and Pylance is not installed', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.pylanceRevertToJediPrompt(),
                Pylance.pylanceInstallPylance(),
                Pylance.pylanceRevertToJedi(),
                Pylance.remindMeLater(),
            ),
        ).thenReturn(Promise.resolve(undefined));

        handler = makeHandler(undefined);
        await handler.handleLanguageServerChange(LanguageServerType.Node);

        verify(
            appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
        ).never();
        verify(
            appShell.showWarningMessage(
                Pylance.pylanceRevertToJediPrompt(),
                Pylance.pylanceInstallPylance(),
                Pylance.pylanceRevertToJedi(),
                Pylance.remindMeLater(),
            ),
        ).once();
    });

    test('Handler should open Pylance store page when language server changes to Pylance, Pylance is not installed and user clicks Yes', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.pylanceRevertToJediPrompt(),
                Pylance.pylanceInstallPylance(),
                Pylance.pylanceRevertToJedi(),
                Pylance.remindMeLater(),
            ),
        ).thenReturn(Promise.resolve(Pylance.pylanceInstallPylance()));

        handler = makeHandler(undefined);
        await handler.handleLanguageServerChange(LanguageServerType.Node);

        verify(commands.executeCommand('extension.open', PYLANCE_EXTENSION_ID)).once();
        verify(commands.executeCommand('workbench.action.reloadWindow')).never();
    });

    test('Handler should not open Pylance store page when language server changes to Pylance, Pylance is not installed and user clicks No', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.pylanceRevertToJediPrompt(),
                Pylance.pylanceInstallPylance(),
                Pylance.pylanceRevertToJedi(),
                Pylance.remindMeLater(),
            ),
        ).thenReturn(Promise.resolve(Pylance.remindMeLater()));

        handler = makeHandler(undefined);
        await handler.handleLanguageServerChange(LanguageServerType.Node);

        verify(commands.executeCommand('extension.open', PYLANCE_EXTENSION_ID)).never();
        verify(commands.executeCommand('workbench.action.reloadWindow')).never();
    });

    test('If Pylance was not installed and now it is, reload should be called if user agreed to it', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.pylanceInstalledReloadPromptMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(Common.bannerLabelYes()));
        handler = makeHandler(LanguageServerType.Node);

        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(pylanceExtension);
        extensionsChangedEvent.fire();

        await handler.pylanceInstallCompleted;
        verify(commands.executeCommand('workbench.action.reloadWindow')).once();
    });

    test('If Pylance was not installed and now it is, reload should not be called if user refused it', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.pylanceInstalledReloadPromptMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(Common.bannerLabelNo()));
        handler = makeHandler(LanguageServerType.Node);

        when(extensions.getExtension(PYLANCE_EXTENSION_ID)).thenReturn(pylanceExtension);
        extensionsChangedEvent.fire();

        await handler.pylanceInstallCompleted;
        verify(commands.executeCommand('workbench.action.reloadWindow')).never();
    });

    [ConfigurationTarget.Global, ConfigurationTarget.Workspace].forEach((target) => {
        const targetName = target === ConfigurationTarget.Global ? 'global' : 'workspace';
        test(`Revert to Jedi with setting in ${targetName} config`, async () => {
            const configuration = mock<WorkspaceConfiguration>();

            when(
                appShell.showWarningMessage(
                    Pylance.pylanceRevertToJediPrompt(),
                    Pylance.pylanceInstallPylance(),
                    Pylance.pylanceRevertToJedi(),
                    Pylance.remindMeLater(),
                ),
            ).thenReturn(Promise.resolve(Pylance.pylanceRevertToJedi()));

            when(workspace.getConfiguration('python')).thenReturn(instance(configuration));

            const inspection = {
                key: 'python.languageServer',
                workspaceValue: target === ConfigurationTarget.Workspace ? LanguageServerType.Node : undefined,
                globalValue: target === ConfigurationTarget.Global ? LanguageServerType.Node : undefined,
            };

            when(configuration.inspect<string>('languageServer')).thenReturn(inspection);

            handler = makeHandler(undefined);
            await handler.handleLanguageServerChange(LanguageServerType.Node);

            verify(
                appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
            ).never();
            verify(
                appShell.showWarningMessage(
                    Pylance.pylanceRevertToJediPrompt(),
                    Pylance.pylanceInstallPylance(),
                    Pylance.pylanceRevertToJedi(),
                    Pylance.remindMeLater(),
                ),
            ).once();
            verify(configService.updateSetting('languageServer', LanguageServerType.Jedi, undefined, target)).once();
        });
    });

    [ConfigurationTarget.WorkspaceFolder, undefined].forEach((target) => {
        const targetName = target === ConfigurationTarget.WorkspaceFolder ? 'workspace folder' : 'missing';
        test(`Revert to Jedi with ${targetName} setting does nothing`, async () => {
            const configuration = mock<WorkspaceConfiguration>();

            when(
                appShell.showWarningMessage(
                    Pylance.pylanceRevertToJediPrompt(),
                    Pylance.pylanceInstallPylance(),
                    Pylance.pylanceRevertToJedi(),
                    Pylance.remindMeLater(),
                ),
            ).thenReturn(Promise.resolve(Pylance.pylanceRevertToJedi()));

            when(workspace.getConfiguration('python')).thenReturn(instance(configuration));

            const inspection = {
                key: 'python.languageServer',
                workspaceFolderValue:
                    target === ConfigurationTarget.WorkspaceFolder ? LanguageServerType.Node : undefined,
            };

            when(configuration.inspect<string>('languageServer')).thenReturn(inspection);

            handler = makeHandler(undefined);
            await handler.handleLanguageServerChange(LanguageServerType.Node);

            verify(
                appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
            ).never();
            verify(
                appShell.showWarningMessage(
                    Pylance.pylanceRevertToJediPrompt(),
                    Pylance.pylanceInstallPylance(),
                    Pylance.pylanceRevertToJedi(),
                    Pylance.remindMeLater(),
                ),
            ).once();
            verify(configService.updateSetting(anything(), anything(), anything(), anything())).never();
        });
    });

    function makeHandler(initialLSType: LanguageServerType | undefined): LanguageServerChangeHandler {
        return new LanguageServerChangeHandler(
            initialLSType,
            instance(extensions),
            instance(appShell),
            instance(commands),
            instance(workspace),
            instance(configService),
        );
    }
});
