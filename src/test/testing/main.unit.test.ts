// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { Disposable, OutputChannel, Uri } from 'vscode';
import { DocumentManager } from '../../client/common/application/documentManager';
import { IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { PythonSettings } from '../../client/common/configSettings';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings } from '../../client/common/types';
import { getNamesAndValues } from '../../client/common/utils/enum';
import { ServiceContainer } from '../../client/ioc/container';
import { IServiceContainer } from '../../client/ioc/types';
import { CommandSource, TEST_OUTPUT_CHANNEL } from '../../client/testing/common/constants';
import { Tests, TestStatus } from '../../client/testing/common/types';
import { TestResultDisplay } from '../../client/testing/display/main';
import { UnitTestManagementService } from '../../client/testing/main';
import { TestManager } from '../../client/testing/nosetest/main';
import { ITestResultDisplay } from '../../client/testing/types';
import { noop } from '../core';

use(chaiAsPromised);

// tslint:disable:no-any max-func-body-length
suite('Unit Tests Test Explorer - Automatically Display', () => {
    let testManagementService: UnitTestManagementService;
    let serviceContainer: IServiceContainer;
    let workspaceService: IWorkspaceService;
    let configService: IConfigurationService;
    let settings: IPythonSettings;
    let testResultsDisplay: ITestResultDisplay;
    const sandbox = sinon.sandbox.create();
    const tests: Tests = {
        rootTestFolders: [],
        summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
        testFiles: [], testFolders: [], testFunctions: [], testSuites: []
    };

    setup(() => {
        configService = mock(ConfigurationService);
        workspaceService = mock(WorkspaceService);
        serviceContainer = mock(ServiceContainer);
        settings = mock(PythonSettings);
        testResultsDisplay = mock(TestResultDisplay);

        when(configService.getSettings(anything())).thenReturn(instance(settings));
        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
        when(serviceContainer.get<Disposable[]>(IDisposableRegistry)).thenReturn([]);
        when(serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL)).thenReturn({} as any);
        when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
        when(serviceContainer.get<IDocumentManager>(IDocumentManager)).thenReturn(instance(mock(DocumentManager)));
        when(serviceContainer.get<ITestResultDisplay>(ITestResultDisplay)).thenReturn(instance(testResultsDisplay));
    });
    teardown(() => {
        sandbox.restore();
    });
    test('Invoking activate will result in auto discovery of tests', async () => {
        sandbox.stub(UnitTestManagementService.prototype, 'registerHandlers');
        sandbox.stub(UnitTestManagementService.prototype, 'registerCommands');
        sandbox.stub(UnitTestManagementService.prototype, 'registerSymbolProvider');
        const autoDiscoverTestsStub = sandbox.stub(UnitTestManagementService.prototype, 'autoDiscoverTests');
        autoDiscoverTestsStub.callsFake(() => Promise.resolve());

        testManagementService = new UnitTestManagementService(instance(serviceContainer));
        await testManagementService.activate({} as any);

        assert.ok(autoDiscoverTestsStub.calledOnceWithExactly(undefined, CommandSource.autoActivate));
    });

    getNamesAndValues<CommandSource>(CommandSource).forEach(cmdSource => {
        test(`Auto discovery will propagate triggerSource to discover tests (${cmdSource.name})`, async () => {
            const resource = Uri.file(__dirname);
            const autoDiscoverTestsStub = sandbox.stub(UnitTestManagementService.prototype, 'discoverTests');
            autoDiscoverTestsStub.callsFake(() => Promise.resolve());
            when(settings.testing).thenReturn({ nosetestsEnabled: true } as any);
            when(workspaceService.hasWorkspaceFolders).thenReturn(true);

            testManagementService = new UnitTestManagementService(instance(serviceContainer));

            await testManagementService.autoDiscoverTests(resource, cmdSource.value);

            assert.ok(autoDiscoverTestsStub.calledOnceWithExactly(cmdSource.value, resource, true));
        });
        test(`When tests are discovered TestDiscovered event is fired (${cmdSource.name})`, async () => {
            const testManager = mock(TestManager);
            const getTestManagerStub = sandbox.stub(UnitTestManagementService.prototype, 'getTestManager');
            const instanceTestManager = instance(testManager);
            (instanceTestManager as any).then = undefined;
            getTestManagerStub.resolves(instanceTestManager);
            when(testResultsDisplay.displayDiscoverStatus(anything(), anything())).thenResolve();
            when(testManager.status).thenReturn(TestStatus.Idle);
            when(testManager.discoverTests(anything(), anything(), anything(), anything(), anything())).thenResolve(tests);

            testManagementService = new UnitTestManagementService(instance(serviceContainer));
            const eventFireStub = sinon.stub();
            testManagementService._onTestsDiscovered.fire = eventFireStub;
            await testManagementService.discoverTests(cmdSource.value, Uri.file(__dirname));

            assert.ok(eventFireStub.calledOnce);
            assert.ok(eventFireStub.calledOnceWithExactly({ triggerSource: cmdSource.value, tests }));
        });
        test(`When tests are not discovered TestDiscovered event is not fired (${cmdSource.name})`, async () => {
            const testManager = mock(TestManager);
            const getTestManagerStub = sandbox.stub(UnitTestManagementService.prototype, 'getTestManager');
            const instanceTestManager = instance(testManager);
            (instanceTestManager as any).then = undefined;
            getTestManagerStub.rejects(new Error('Failed'));
            when(testResultsDisplay.displayDiscoverStatus(anything(), anything())).thenResolve();
            when(testManager.status).thenReturn(TestStatus.Idle);
            when(testManager.discoverTests(anything(), anything(), anything(), anything(), anything())).thenResolve(tests);

            testManagementService = new UnitTestManagementService(instance(serviceContainer));
            const eventFireStub = sinon.stub();
            testManagementService._onTestsDiscovered.fire = eventFireStub;
            const promise = testManagementService.discoverTests(cmdSource.value, Uri.file(__dirname));
            await promise.catch(noop);

            assert.ok(eventFireStub.notCalled);
            await expect(promise).to.eventually.be.rejectedWith('Failed');
        });
    });
});
