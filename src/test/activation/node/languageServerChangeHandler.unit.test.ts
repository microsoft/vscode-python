// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anyString, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Extension } from 'vscode';
import { LanguageServerChangeHandler } from '../../../client/activation/common/languageServerChangeHandler';
import { LanguageServerType } from '../../../client/activation/types';
import { IApplicationEnvironment, IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../../client/common/constants';
import { IExtensions } from '../../../client/common/types';
import { Common, LanguageService, Pylance } from '../../../client/common/utils/localize';

suite('Language Server - Change Handler', () => {
    let extensions: IExtensions;
    let appShell: IApplicationShell;
    let appEnv: IApplicationEnvironment;
    let commands: ICommandManager;
    let extensionsChangedEvent: EventEmitter<void>;
    let handler: LanguageServerChangeHandler;

    let pylanceExtension: Extension<any>;
    setup(() => {
        extensions = mock<IExtensions>();
        appShell = mock<IApplicationShell>();
        appEnv = mock<IApplicationEnvironment>();
        commands = mock<ICommandManager>();

        pylanceExtension = mock<Extension<any>>();
        when(appEnv.uriScheme).thenReturn('scheme');

        extensionsChangedEvent = new EventEmitter<void>();
        when(extensions.onDidChange).thenReturn(extensionsChangedEvent.event);
    });
    teardown(() => {
        extensionsChangedEvent.dispose();
        handler?.dispose();
    });

    [undefined, LanguageServerType.None, LanguageServerType.Microsoft, LanguageServerType.Node].forEach(async (t) => {
        test(`Handler should do nothing if language server is ${t} and did not change`, async () => {
            handler = makeHandler(t);
            await handler.handleLanguageServerChange(t);

            verify(extensions.getExtension(anyString())).once();
            verify(appShell.openUrl(anyString())).never();
            verify(appShell.showInformationMessage(anyString(), anyString())).never();
            verify(appShell.showWarningMessage(anyString(), anyString())).never();
            verify(commands.executeCommand(anyString())).never();
        });
    });

    [LanguageServerType.None, LanguageServerType.Microsoft, LanguageServerType.Node].forEach(async (t) => {
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

    [LanguageServerType.None, LanguageServerType.Microsoft, LanguageServerType.Node].forEach(async (t) => {
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
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(undefined));

        handler = makeHandler(undefined);
        await handler.handleLanguageServerChange(LanguageServerType.Node);

        verify(
            appShell.showInformationMessage(LanguageService.reloadAfterLanguageServerChange(), Common.reload()),
        ).never();
        verify(
            appShell.showWarningMessage(
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).once();
    });

    test('Handler should open Pylance store page when language server changes to Pylance, Pylance is not installed and user clicks Yes', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(Common.bannerLabelYes()));

        handler = makeHandler(undefined);
        await handler.handleLanguageServerChange(LanguageServerType.Node);

        verify(appShell.openUrl(`scheme:extension/${PYLANCE_EXTENSION_ID}`)).once();
        verify(commands.executeCommand('workbench.action.reloadWindow')).never();
    });

    test('Handler should not open Pylance store page when language server changes to Pylance, Pylance is not installed and user clicks No', async () => {
        when(
            appShell.showWarningMessage(
                Pylance.installPylanceMessage(),
                Common.bannerLabelYes(),
                Common.bannerLabelNo(),
            ),
        ).thenReturn(Promise.resolve(Common.bannerLabelNo()));

        handler = makeHandler(undefined);
        await handler.handleLanguageServerChange(LanguageServerType.Node);

        verify(appShell.openUrl(`scheme:extension/${PYLANCE_EXTENSION_ID}`)).never();
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

    function makeHandler(initialLSType: LanguageServerType | undefined): LanguageServerChangeHandler {
        return new LanguageServerChangeHandler(
            initialLSType,
            instance(extensions),
            instance(appShell),
            instance(appEnv),
            instance(commands),
        );
    }
});
