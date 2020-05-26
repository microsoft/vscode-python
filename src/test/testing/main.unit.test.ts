// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable } from 'vscode';
import { CommandManager } from '../../client/common/application/commandManager';
import { ICommandManager } from '../../client/common/application/types';
import { AlwaysDisplayTestExplorerGroups } from '../../client/common/experiments/groups';
import { ExperimentsManager } from '../../client/common/experiments/manager';
import { IDisposableRegistry, IExperimentsManager } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { IServiceContainer } from '../../client/ioc/types';
import { JediSymbolProvider } from '../../client/providers/symbolProvider';
import { UnitTestManagementService } from '../../client/testing/main';

suite('Unit Tests - ManagementService', () => {
    suite('Experiments', () => {
        let serviceContainer: IServiceContainer;
        let sandbox: sinon.SinonSandbox;
        let experiment: IExperimentsManager;
        let commandManager: ICommandManager;
        let testManagementService: UnitTestManagementService;
        setup(() => {
            serviceContainer = mock(ServiceContainer);
            sandbox = sinon.createSandbox();

            sandbox.stub(UnitTestManagementService.prototype, 'registerSymbolProvider');
            sandbox.stub(UnitTestManagementService.prototype, 'registerCommands');
            sandbox.stub(UnitTestManagementService.prototype, 'registerHandlers');
            sandbox.stub(UnitTestManagementService.prototype, 'autoDiscoverTests').callsFake(() => Promise.resolve());

            experiment = mock(ExperimentsManager);
            commandManager = mock(CommandManager);

            when(serviceContainer.get<Disposable[]>(IDisposableRegistry)).thenReturn([]);
            when(serviceContainer.get<IExperimentsManager>(IExperimentsManager)).thenReturn(instance(experiment));
            when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(commandManager));
            when(commandManager.executeCommand(anything(), anything(), anything())).thenResolve();

            testManagementService = new UnitTestManagementService(instance(serviceContainer));
        });
        teardown(() => {
            sandbox.restore();
        });

        test('Execute command if in experiment', async () => {
            when(experiment.inExperiment(AlwaysDisplayTestExplorerGroups.experiment)).thenReturn(true);

            await testManagementService.activate(instance(mock(JediSymbolProvider)));

            verify(commandManager.executeCommand('setContext', 'testsDiscovered', true)).once();
            verify(experiment.inExperiment(AlwaysDisplayTestExplorerGroups.experiment)).once();
            verify(experiment.inExperiment(AlwaysDisplayTestExplorerGroups.control)).never();
            verify(experiment.sendTelemetryIfInExperiment(anything())).never();
        });
        test('If not in experiment, check and send Telemetry for control group and do not execute command', async () => {
            when(experiment.inExperiment(AlwaysDisplayTestExplorerGroups.experiment)).thenReturn(false);

            await testManagementService.activate(instance(mock(JediSymbolProvider)));

            verify(commandManager.executeCommand('setContext', 'testsDiscovered', anything())).never();
            verify(experiment.inExperiment(AlwaysDisplayTestExplorerGroups.experiment)).once();
            verify(experiment.inExperiment(AlwaysDisplayTestExplorerGroups.control)).never();
            verify(experiment.sendTelemetryIfInExperiment(AlwaysDisplayTestExplorerGroups.control)).once();
        });
    });
});
