// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable, OutputChannel, Uri } from 'vscode';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { PythonSettings } from '../../../../client/common/configSettings';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings } from '../../../../client/common/types';
import { ServiceContainer } from '../../../../client/ioc/container';
import { IServiceContainer } from '../../../../client/ioc/types';
import { CommandSource, TEST_OUTPUT_CHANNEL } from '../../../../client/unittests/common/constants';
import { TestCollectionStorageService } from '../../../../client/unittests/common/services/storageService';
import { TestResultsService } from '../../../../client/unittests/common/services/testResultsService';
import { TestsStatusUpdaterService } from '../../../../client/unittests/common/services/testsStatusService';
import { UnitTestDiagnosticService } from '../../../../client/unittests/common/services/unitTestDiagnosticService';
import { TestsHelper } from '../../../../client/unittests/common/testUtils';
import { ITestCollectionStorageService, ITestManager, ITestMessageService, ITestResultsService, ITestsHelper, ITestsStatusUpdaterService } from '../../../../client/unittests/common/types';
import { TestManager as NoseTestManager } from '../../../../client/unittests/nosetest/main';
import { TestManager as PyTestTestManager } from '../../../../client/unittests/pytest/main';
import { ArgumentsService } from '../../../../client/unittests/pytest/services/argsService';
import { TestMessageService } from '../../../../client/unittests/pytest/services/testMessageService';
import { IArgumentsService, ITestManagerRunner, IUnitTestDiagnosticService } from '../../../../client/unittests/types';
import { TestManager as UnitTestTestManager } from '../../../../client/unittests/unittest/main';
import { TestManagerRunner } from '../../../../client/unittests/unittest/runner';
import { noop } from '../../../core';
import { MockOutputChannel } from '../../../mockClasses';

suite('Unit Tests - Base Test Manager', () => {
    [
        { name: 'nose', class: NoseTestManager },
        { name: 'pytest', class: PyTestTestManager },
        { name: 'unittest', class: UnitTestTestManager }
    ].forEach(item => {
        suite(item.name, () => {
            let testManager: ITestManager;
            const workspaceFolder = Uri.file(__dirname);
            let serviceContainer: IServiceContainer;
            let configService: IConfigurationService;
            let settings: IPythonSettings;
            let outputChannel: IOutputChannel;
            let storageService: ITestCollectionStorageService;
            let resultsService: ITestResultsService;
            let workspaceService: IWorkspaceService;
            let diagnosticService: IUnitTestDiagnosticService;
            let statusUpdater: ITestsStatusUpdaterService;
            let commandManager: ICommandManager;
            setup(() => {
                serviceContainer = mock(ServiceContainer);
                settings = mock(PythonSettings);
                configService = mock(ConfigurationService);
                outputChannel = mock(MockOutputChannel);
                storageService = mock(TestCollectionStorageService);
                resultsService = mock(TestResultsService);
                workspaceService = mock(WorkspaceService);
                diagnosticService = mock(UnitTestDiagnosticService);
                statusUpdater = mock(TestsStatusUpdaterService);
                commandManager = mock(CommandManager);

                const argsService = mock(ArgumentsService);
                const testsHelper = mock(TestsHelper);
                const runner = mock(TestManagerRunner);
                const messageService = mock(TestMessageService);

                when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
                when(serviceContainer.get<Disposable[]>(IDisposableRegistry)).thenReturn([]);
                when(serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL)).thenReturn(instance(outputChannel));
                when(serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService)).thenReturn(instance(storageService));
                when(serviceContainer.get<ITestResultsService>(ITestResultsService)).thenReturn(instance(resultsService));
                when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
                when(serviceContainer.get<IUnitTestDiagnosticService>(IUnitTestDiagnosticService)).thenReturn(instance(diagnosticService));
                when(serviceContainer.get<ITestsStatusUpdaterService>(ITestsStatusUpdaterService)).thenReturn(instance(statusUpdater));
                when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(commandManager));

                when(serviceContainer.get<IArgumentsService>(IArgumentsService, anything())).thenReturn(instance(argsService));
                when(serviceContainer.get<ITestsHelper>(ITestsHelper)).thenReturn(instance(testsHelper));
                when(serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, anything())).thenReturn(instance(runner));
                when(serviceContainer.get<ITestMessageService>(ITestMessageService, anything())).thenReturn(instance(messageService));

                when(configService.getSettings(anything())).thenReturn(instance(settings));

                testManager = new item.class(workspaceFolder, workspaceFolder.fsPath, instance(serviceContainer));
            });

            test('Discovering tests should display test manager', async () => {
                when(commandManager.executeCommand(anything(), anything(), anything())).thenResolve();

                try {
                    await testManager.discoverTests(CommandSource.auto, true, true, true);
                } catch {
                    noop();
                }

                verify(commandManager.executeCommand('setContext', 'testsDiscovered', true)).once();
            });
        });
    });
});
