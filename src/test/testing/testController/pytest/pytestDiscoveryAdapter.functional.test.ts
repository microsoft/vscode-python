/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { WorkspaceFolder } from 'vscode';
import * as typeMoq from 'typemoq';
import { PytestTestDiscoveryAdapter } from '../../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import {
    ITestDiscoveryAdapter,
    ITestResultResolver,
    ITestServer,
} from '../../../../client/testing/testController/common/types';
import { PythonTestServer } from '../../../../client/testing/testController/common/server';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { IPythonExecutionFactory } from '../../../../client/common/process/types';
import { ITestDebugLauncher } from '../../../../client/testing/common/types';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { IServiceContainer } from '../../../../client/ioc/types';
import { initialize } from '../../../initialize';

suite('Functional Tests: pytest test discovery adapter ejfb', () => {
    let resultResolver: typeMoq.IMock<ITestResultResolver>;
    let discoveryAdapter: ITestDiscoveryAdapter;
    // let testController: TestController;
    // let testProvider: TestProvider;
    let pythonTestServer: ITestServer;
    let pythonExecFactory: IPythonExecutionFactory;
    let debugLauncher: ITestDebugLauncher;
    let workspace: WorkspaceFolder;
    let workspaceService: IWorkspaceService;
    let configService: IConfigurationService;
    let testOutputChannel: ITestOutputChannel;
    let serviceContainer: IServiceContainer;
    suiteSetup(async () => {
        // if (!IS_SMOKE_TEST) {
        //     this.skip();
        // }
        serviceContainer = (await initialize()).serviceContainer;
    });

    setup(() => {
        // create objects that were injected
        configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        pythonExecFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
        workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        testOutputChannel = serviceContainer.get<ITestOutputChannel>(ITestOutputChannel);

        // create objects that were not injected
        const workspaces = workspaceService.workspaceFolders || [];
        [workspace] = workspaces; // usually this is a for-each loop but we know there will only be one workspace
        // testProvider = PYTEST_PROVIDER;
        // testController = tests.createTestController('python-tests', 'Python Tests');
        pythonTestServer = new PythonTestServer(pythonExecFactory, debugLauncher);
        resultResolver = typeMoq.Mock.ofType<ITestResultResolver>();
        discoveryAdapter = new PytestTestDiscoveryAdapter(
            pythonTestServer,
            configService,
            testOutputChannel,
            resultResolver.object,
        );
    });
    test('ejfb test', async () => {
        discoveryAdapter.discoverTests(workspace.uri, pythonExecFactory);
    });
});
