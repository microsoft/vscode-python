// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anyFunction, anything, instance, mock, verify, when } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { SourceMapSupportService } from '../../../client/application/diagnostics/surceMapSupportService';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { Commands } from '../../../client/common/constants';
import { Diagnostics } from '../../../client/common/utils/localize';

suite('Diagnostisc - Source Maps', () => {
    test('Command is registered', async () => {
        const commandManager = mock(CommandManager);
        const service = new SourceMapSupportService(instance(commandManager), [], undefined as any, undefined as any);
        service.register();
        verify(commandManager.registerCommand(Commands.Enable_SourceMap_Support, anyFunction(), service)).once();
    });
    test('Setting is turned on and vsc reloaded', async () => {
        const commandManager = mock(CommandManager);
        const configService = mock(ConfigurationService);
        const service = new SourceMapSupportService(
            instance(commandManager),
            [],
            instance(configService),
            undefined as any,
        );
        when(
            configService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global),
        ).thenResolve();
        when(commandManager.executeCommand('workbench.action.reloadWindow')).thenResolve();

        await service.enable();

        verify(
            configService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global),
        ).once();
        verify(commandManager.executeCommand('workbench.action.reloadWindow')).once();
    });
    test('Display prompt and do not enable', async () => {
        const shell = mock(ApplicationShell);
        const service = new (class extends SourceMapSupportService {
            public async enable() {
                throw new Error('Should not be invokved');
            }
            public async onEnable() {
                await super.onEnable();
            }
        })(undefined as any, [], undefined as any, instance(shell));
        when(shell.showWarningMessage(anything(), anything())).thenResolve();

        await service.onEnable();
    });
    test('Display prompt and must enable', async () => {
        const commandManager = mock(CommandManager);
        const configService = mock(ConfigurationService);
        const shell = mock(ApplicationShell);
        const service = new (class extends SourceMapSupportService {
            public async onEnable() {
                await super.onEnable();
            }
        })(instance(commandManager), [], instance(configService), instance(shell));

        when(
            configService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global),
        ).thenResolve();
        when(shell.showWarningMessage(anything(), anything())).thenResolve(
            Diagnostics.enableSourceMapsAndReloadVSC as any,
        );
        when(commandManager.executeCommand('workbench.action.reloadWindow')).thenResolve();

        await service.onEnable();

        verify(
            configService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global),
        ).once();
        verify(commandManager.executeCommand('workbench.action.reloadWindow')).once();
    });
});
