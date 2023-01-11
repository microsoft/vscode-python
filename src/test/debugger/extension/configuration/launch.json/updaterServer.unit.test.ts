// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify } from 'ts-mockito';
import { CommandManager } from '../../../../../client/common/application/commandManager';
import { ICommandManager } from '../../../../../client/common/application/types';
import { PythonDebugConfigurationService } from '../../../../../client/debugger/extension/configuration/debugConfigurationService';
import { LaunchJsonUpdaterService } from '../../../../../client/debugger/extension/configuration/launch.json/updaterService';
import { LaunchJsonUpdaterServiceHelper } from '../../../../../client/debugger/extension/configuration/launch.json/updaterServiceHelper';
import { IDebugConfigurationService } from '../../../../../client/debugger/extension/types';

suite('Debugging - launch.json Updater Service', () => {
    let helper: LaunchJsonUpdaterServiceHelper;
    let commandManager: ICommandManager;
    let debugConfigService: IDebugConfigurationService;
    setup(() => {
        commandManager = mock(CommandManager);
        debugConfigService = mock(PythonDebugConfigurationService);
        helper = new LaunchJsonUpdaterServiceHelper(instance(debugConfigService));
    });
    test('Activation will register the required commands', async () => {
        const service = new LaunchJsonUpdaterService([], instance(debugConfigService));
        await service.activate();
        verify(
            commandManager.registerCommand(
                'python.SelectAndInsertDebugConfiguration',
                helper.selectAndInsertDebugConfig,
                helper,
            ),
        );
    });
});
