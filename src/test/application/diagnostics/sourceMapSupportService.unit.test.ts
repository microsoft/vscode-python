// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { anyFunction, instance, mock, verify, when } from 'ts-mockito';
import { ConfigurationTarget } from 'vscode';
import { SourceMapSupportService } from '../../../client/application/diagnostics/surceMapSupportService';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { Commands } from '../../../client/common/constants';

suite('Diagnostisc - Source Maps', () => {
    test('Command is registered', async () => {
        const commandManager = mock(CommandManager);
        const service = new SourceMapSupportService(instance(commandManager), [], undefined as any);
        service.register();
        verify(commandManager.registerCommand(Commands.Enable_SourceMap_Support, anyFunction(), service)).once();
    });
    test('Setting is turned on', async () => {
        const configService = mock(ConfigurationService);
        const service = new SourceMapSupportService(undefined as any, [], instance(configService));
        when(configService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global)).thenResolve();

        await service.enable();
        verify(configService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global)).once();
    });
});
