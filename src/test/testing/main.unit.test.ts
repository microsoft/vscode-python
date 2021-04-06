// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable } from 'vscode';
import { CommandManager } from '../../client/common/application/commandManager';
import { ICommandManager } from '../../client/common/application/types';
import { IDisposableRegistry } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { IServiceContainer } from '../../client/ioc/types';
import { JediSymbolProvider } from '../../client/providers/symbolProvider';
import { UnitTestManagementService } from '../../client/testing/main';

suite('Unit Tests - ManagementService', () => {
    suite('Experiments', () => {
        let serviceContainer: IServiceContainer;
        let sandbox: sinon.SinonSandbox;
        let commandManager: ICommandManager;
        let testManagementService: UnitTestManagementService;
        setup(() => {
            serviceContainer = mock(ServiceContainer);
            sandbox = sinon.createSandbox();

            sandbox.stub(UnitTestManagementService.prototype, 'registerSymbolProvider');
            sandbox.stub(UnitTestManagementService.prototype, 'registerCommands');
            sandbox.stub(UnitTestManagementService.prototype, 'registerHandlers');
            sandbox.stub(UnitTestManagementService.prototype, 'autoDiscoverTests').callsFake(() => Promise.resolve());

            commandManager = mock(CommandManager);

            when(serviceContainer.get<Disposable[]>(IDisposableRegistry)).thenReturn([]);
            when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(commandManager));
            when(commandManager.executeCommand(anything(), anything(), anything())).thenResolve();

            testManagementService = new UnitTestManagementService(instance(serviceContainer));
        });
        teardown(() => {
            sandbox.restore();
        });

        test('Do not execute command', async () => {
            await testManagementService.activate(instance(mock(JediSymbolProvider)));

            verify(commandManager.executeCommand('setContext', 'testsDiscovered', anything())).never();
        });
    });
});
