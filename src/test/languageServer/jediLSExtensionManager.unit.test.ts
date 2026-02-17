// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import { IWorkspaceService, ICommandManager, IApplicationShell } from '../../client/common/application/types';
import {
    IExperimentService,
    IConfigurationService,
    IInterpreterPathService,
    ILogOutputChannel,
} from '../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { JediLSExtensionManager } from '../../client/languageServer/jediLSExtensionManager';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

suite('Language Server - Jedi LS extension manager', () => {
    let manager: JediLSExtensionManager;

    setup(() => {
        // Create a mock ILogOutputChannel
        const mockOutputChannel = {} as ILogOutputChannel;

        // Create a mock IApplicationShell with createOutputChannel method
        const mockApplicationShell = ({
            createOutputChannel: () => mockOutputChannel,
        } as unknown) as IApplicationShell;

        // Create a mock service container with the required get method
        const mockServiceContainer = {
            get: (serviceIdentifier: any) => {
                if (serviceIdentifier === IApplicationShell) {
                    return mockApplicationShell;
                }
                return undefined;
            },
        } as IServiceContainer;

        manager = new JediLSExtensionManager(
            mockServiceContainer,
            {} as IExperimentService,
            {} as IWorkspaceService,
            {} as IConfigurationService,
            {} as IInterpreterPathService,
            {} as IInterpreterService,
            {} as IEnvironmentVariablesProvider,
            ({
                registerCommand: () => {
                    /* do nothing */
                },
            } as unknown) as ICommandManager,
        );
    });

    test('Constructor should create a client proxy, a server manager and a server proxy', () => {
        assert.notStrictEqual(manager.clientFactory, undefined);
        assert.notStrictEqual(manager.serverManager, undefined);
    });

    test('canStartLanguageServer should return true if an interpreter is passed in', () => {
        const result = manager.canStartLanguageServer(({
            path: 'path/to/interpreter',
        } as unknown) as PythonEnvironment);

        assert.strictEqual(result, true);
    });

    test('canStartLanguageServer should return false otherwise', () => {
        const result = manager.canStartLanguageServer(undefined);

        assert.strictEqual(result, false);
    });
});
