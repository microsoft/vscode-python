// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable, OutputChannel, Uri } from 'vscode';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ICommandManager, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { PythonSettings } from '../../../../client/common/configSettings';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { ModuleNotInstalledError } from '../../../../client/common/errors/moduleNotInstalledError';
import { ProductInstaller } from '../../../../client/common/installer/productInstaller';
import {
    IConfigurationService,
    IDisposableRegistry,
    IInstaller,
    IOutputChannel,
    IPythonSettings,
} from '../../../../client/common/types';
import { ServiceContainer } from '../../../../client/ioc/container';
import { IServiceContainer } from '../../../../client/ioc/types';
import { CommandSource, TEST_OUTPUT_CHANNEL } from '../../../../client/testing/common/constants';
import { TestCollectionStorageService } from '../../../../client/testing/common/services/storageService';
import { TestResultsService } from '../../../../client/testing/common/services/testResultsService';
import { TestsStatusUpdaterService } from '../../../../client/testing/common/services/testsStatusService';
import { UnitTestDiagnosticService } from '../../../../client/testing/common/services/unitTestDiagnosticService';
import { TestsHelper } from '../../../../client/testing/common/testUtils';
import {
    ITestCollectionStorageService,
    ITestDiscoveryService,
    ITestManager,
    ITestMessageService,
    ITestResultsService,
    ITestsHelper,
    ITestsStatusUpdaterService,
} from '../../../../client/testing/common/types';
import { TestManager as NoseTestManager } from '../../../../client/testing/nosetest/main';
import { TestManager as PyTestTestManager } from '../../../../client/testing/pytest/main';
import { ArgumentsService } from '../../../../client/testing/pytest/services/argsService';
import { TestDiscoveryService } from '../../../../client/testing/pytest/services/discoveryService';
import { TestMessageService } from '../../../../client/testing/pytest/services/testMessageService';
import { IArgumentsService, ITestDiagnosticService, ITestManagerRunner } from '../../../../client/testing/types';
import { TestManager as UnitTestTestManager } from '../../../../client/testing/unittest/main';
import { TestManagerRunner } from '../../../../client/testing/unittest/runner';
import { noop } from '../../../core';
import { MockOutputChannel } from '../../../mockClasses';

suite('Unit Tests - Base Test Manager', () => {
    [
        { name: 'nose', class: NoseTestManager },
        { name: 'pytest', class: PyTestTestManager },
        { name: 'unittest', class: UnitTestTestManager },
    ].forEach((item) => {
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
            let diagnosticService: ITestDiagnosticService;
            let statusUpdater: ITestsStatusUpdaterService;
            let commandManager: ICommandManager;
            let testDiscoveryService: ITestDiscoveryService;
            let installer: IInstaller;
            const sandbox = sinon.createSandbox();
            suiteTeardown(() => sandbox.restore());
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
                testDiscoveryService = mock(TestDiscoveryService);
                installer = mock(ProductInstaller);

                const argsService = mock(ArgumentsService);
                const testsHelper = mock(TestsHelper);
                const runner = mock(TestManagerRunner);
                const messageService = mock(TestMessageService);

                when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
                    instance(configService),
                );
                when(serviceContainer.get<Disposable[]>(IDisposableRegistry)).thenReturn([]);
                when(serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL)).thenReturn(
                    instance(outputChannel),
                );
                when(serviceContainer.get<ITestCollectionStorageService>(ITestCollectionStorageService)).thenReturn(
                    instance(storageService),
                );
                when(serviceContainer.get<ITestResultsService>(ITestResultsService)).thenReturn(
                    instance(resultsService),
                );
                when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
                when(serviceContainer.get<ITestDiagnosticService>(ITestDiagnosticService)).thenReturn(
                    instance(diagnosticService),
                );
                when(serviceContainer.get<ITestsStatusUpdaterService>(ITestsStatusUpdaterService)).thenReturn(
                    instance(statusUpdater),
                );
                when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(commandManager));

                when(serviceContainer.get<IArgumentsService>(IArgumentsService, anything())).thenReturn(
                    instance(argsService),
                );
                when(serviceContainer.get<ITestsHelper>(ITestsHelper)).thenReturn(instance(testsHelper));
                when(serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, anything())).thenReturn(
                    instance(runner),
                );
                when(serviceContainer.get<ITestMessageService>(ITestMessageService, anything())).thenReturn(
                    instance(messageService),
                );

                when(serviceContainer.get<ITestDiscoveryService>(ITestDiscoveryService, anything())).thenReturn(
                    instance(testDiscoveryService),
                );
                when(serviceContainer.get<IInstaller>(IInstaller)).thenReturn(instance(installer));

                when(configService.getSettings(anything())).thenReturn(instance(settings));
                when(commandManager.executeCommand(anything(), anything(), anything())).thenResolve();

                sandbox.restore();
                sandbox.stub(item.class.prototype, 'getDiscoveryOptions').callsFake(() => ({} as any));

                testManager = new item.class(workspaceFolder, workspaceFolder.fsPath, instance(serviceContainer));
            });

            test('Discovering tests should display test manager', async () => {
                // We don't care about failures in running code
                // Just test our expectations, ignore everything else.
                await testManager.discoverTests(CommandSource.auto, true, true, true).catch(noop);

                verify(commandManager.executeCommand('setContext', 'testsDiscovered', true)).once();
            });
            test('When failing to discover tests prompt to install test framework', async function () {
                if (item.name === 'unittest') {
                    return this.skip();
                }

                when(testDiscoveryService.discoverTests(anything())).thenReject(new ModuleNotInstalledError('Kaboom'));
                when(installer.isInstalled(anything(), anything())).thenResolve(false);
                when(installer.promptToInstall(anything(), anything())).thenResolve();

                // We don't care about failures in running code
                // Just test our expectations, ignore everything else.
                await testManager.discoverTests(CommandSource.ui, true, false, true).catch(noop);

                verify(installer.isInstalled(anything(), anything())).once();
                verify(installer.promptToInstall(anything(), anything())).once();
            });
            test('When failing to discover tests do not prompt to install test framework', async function () {
                if (item.name === 'unittest') {
                    return this.skip();
                }

                when(testDiscoveryService.discoverTests(anything())).thenReject(new Error('Kaboom'));
                when(installer.isInstalled(anything(), anything())).thenResolve(false);
                when(installer.promptToInstall(anything(), anything())).thenResolve();

                // We don't care about failures in running code
                // Just test our expectations, ignore everything else.
                await testManager.discoverTests(CommandSource.ui, true, false, true).catch(noop);

                verify(installer.isInstalled(anything(), anything())).never();
                verify(installer.promptToInstall(anything(), anything())).never();
            });
            test('When failing to discover tests do not prompt to install test framework if installed', async function () {
                if (item.name === 'unittest') {
                    return this.skip();
                }

                when(testDiscoveryService.discoverTests(anything())).thenReject(new ModuleNotInstalledError('Kaboom'));
                when(installer.isInstalled(anything(), anything())).thenResolve(true);
                when(installer.promptToInstall(anything(), anything())).thenResolve();

                // We don't care about failures in running code
                // Just test our expectations, ignore everything else.
                await testManager.discoverTests(CommandSource.ui, true, false, true).catch(noop);

                verify(installer.isInstalled(anything(), anything())).once();
                verify(installer.promptToInstall(anything(), anything())).never();
            });
        });
    });
});
