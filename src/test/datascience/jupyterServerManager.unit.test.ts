// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { IFileSystem } from '../../client/common/platform/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDataScienceSettings, IPythonSettings } from '../../client/common/types';
import { JupyterServerManager } from '../../client/datascience/jupyter/jupyterServerManager';
import { IJupyterExecution, INotebookServer, INotebookServerLaunchInfo, IStatusProvider } from '../../client/datascience/types';
import { IInterpreterService, InterpreterType } from '../../client/interpreter/contracts';

suite('JupyterServerManager unit tests', () => {
    let disposableRegistry: typemoq.IMock<IAsyncDisposableRegistry>;
    let configuration: typemoq.IMock<IConfigurationService>;
    let execution: typemoq.IMock<IJupyterExecution>;
    let statusProvider: typemoq.IMock<IStatusProvider>;
    let interpreter: typemoq.IMock<IInterpreterService>;
    let currentInterpreter;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let workspace: typemoq.IMock<IWorkspaceService>;
    let dataScienceSettings: typemoq.IMock<IDataScienceSettings>;
    let serverManager: JupyterServerManager;

    function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result: typemoq.IMock<T> = typemoq.Mock.ofType<T>();
        (result as any)['tag'] = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    setup(() => {
        disposableRegistry = typemoq.Mock.ofType<IAsyncDisposableRegistry>();
        configuration = typemoq.Mock.ofType<IConfigurationService>();
        execution = typemoq.Mock.ofType<IJupyterExecution>();
        statusProvider = typemoq.Mock.ofType<IStatusProvider>();
        interpreter = typemoq.Mock.ofType<IInterpreterService>();
        fileSystem = typemoq.Mock.ofType<IFileSystem>();
        workspace = typemoq.Mock.ofType<IWorkspaceService>();

        // Setup our workspace
        workspace
            .setup(w => w.hasWorkspaceFolders)
            .returns(() => true);
        const ws = [{ uri: Uri.file('x') }];
        workspace
            .setup(w => w.workspaceFolders)
            .returns(() => ws as any);

        // Tell our file system that the directory exists
        fileSystem.setup(fs => fs.directoryExists(typemoq.It.isAny())).returns(() => { return Promise.resolve(true); });

        // Get our interpreter service set
        currentInterpreter = { type: InterpreterType.Unknown };
        interpreter
            .setup(i => i.getActiveInterpreter(typemoq.It.isAny()))
            .returns(() => { return Promise.resolve(currentInterpreter as any); });

        // Get our default settings prepped
        const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
        dataScienceSettings = typemoq.Mock.ofType<IDataScienceSettings>();
        dataScienceSettings.setup(d => d.useDefaultConfigForJupyter).returns(() => true);
        const workspacePath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
        dataScienceSettings.setup(d => d.notebookFileRoot).returns(() => workspacePath);
        pythonSettings.setup(p => p.datascience).returns(() => dataScienceSettings.object);
        configuration.setup(c => c.getSettings(typemoq.It.isAny())).returns(() => pythonSettings.object);

        serverManager = new JupyterServerManager(disposableRegistry.object, configuration.object, interpreter.object,
            fileSystem.object, execution.object, statusProvider.object, workspace.object);
    });
    test('JupyterServerManager create new', async () => {
        // Get our settings for this test configured
        dataScienceSettings.setup(d => d.jupyterServerURI).returns(() => 'https://hostname:8080/?token=849d61a414abafab97bc4aab1f3547755ddc232c2b8cb7fe');

        // Create our fake notebook server
        const fakeServer: typemoq.IMock<INotebookServer> = createTypeMoq<INotebookServer>('First Server');

        // Set our execution
        execution.setup(e => e.connectToNotebookServer(typemoq.It.isAny(), typemoq.It.isAny(),
        typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny())).returns(() => {
            return Promise.resolve(fakeServer.object);
        }).verifiable(typemoq.Times.once());

        await serverManager.getOrCreateServer();

        execution.verifyAll();
    });
    test('JupyterServerManager reuse existing', async () => {
        // Get our settings for this test configured
        dataScienceSettings.setup(d => d.jupyterServerURI).returns(() => 'local');

        // Create our fake notebook server
        const fakeServer: typemoq.IMock<INotebookServer> = createTypeMoq<INotebookServer>('First Server');
        const fakeLaunchInfo: typemoq.IMock<INotebookServerLaunchInfo> = typemoq.Mock.ofType<INotebookServerLaunchInfo>();
        fakeLaunchInfo.setup(li => li.uri).returns(() => undefined).verifiable(typemoq.Times.once()); // local gets set to undefined at launch
        fakeLaunchInfo.setup(li => li.usingDarkTheme).returns(() => false).verifiable(typemoq.Times.once());
        const workspacePath = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');
        fakeLaunchInfo.setup(li => li.workingDir).returns(() => workspacePath).verifiable(typemoq.Times.once());
        fakeLaunchInfo.setup(li => li.currentInterpreter).returns(() => { return currentInterpreter as any; }).verifiable(typemoq.Times.once());

        // Set our fake server to return this launch info
        fakeServer.setup(fs => fs.getLaunchInfo()).returns(() => {
           return fakeLaunchInfo.object;
        });

        // Set our execution
        execution.setup(e => e.connectToNotebookServer(typemoq.It.isAny(), typemoq.It.isAny(),
        typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny())).returns(() => {
            return Promise.resolve(fakeServer.object);
        }).verifiable(typemoq.Times.once());

        await serverManager.getOrCreateServer();
        await serverManager.getOrCreateServer();

        // Execution should only have been called once, not twice
        execution.verifyAll();
        fakeLaunchInfo.verifyAll();
    });
    test('JupyterServerManager don"t reuse existing', async () => {
        // Get our settings for this test configured
        dataScienceSettings.setup(d => d.jupyterServerURI).returns(() => 'local');

        // Create our fake notebook server
        const fakeServer: typemoq.IMock<INotebookServer> = createTypeMoq<INotebookServer>('First Server');
        const fakeLaunchInfo: typemoq.IMock<INotebookServerLaunchInfo> = typemoq.Mock.ofType<INotebookServerLaunchInfo>();
        fakeLaunchInfo.setup(li => li.uri).returns(() => undefined).verifiable(typemoq.Times.once()); // local gets set to undefined at launch
        fakeLaunchInfo.setup(li => li.usingDarkTheme).returns(() => false).verifiable(typemoq.Times.once());
        const workspacePath = path.join(EXTENSION_ROOT_DIR, 'src', 'test'); // Change the ws path so we don't reuse
        fakeLaunchInfo.setup(li => li.workingDir).returns(() => workspacePath).verifiable(typemoq.Times.once());
        fakeLaunchInfo.setup(li => li.currentInterpreter).returns(() => { return currentInterpreter as any; }).verifiable(typemoq.Times.never()); // Never

        // Set our fake server to return this launch info
        fakeServer.setup(fs => fs.getLaunchInfo()).returns(() => {
           return fakeLaunchInfo.object;
        });

        // Set our execution
        execution.setup(e => e.connectToNotebookServer(typemoq.It.isAny(), typemoq.It.isAny(),
        typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny())).returns(() => {
            return Promise.resolve(fakeServer.object);
        }).verifiable(typemoq.Times.exactly(2)); // Twice

        await serverManager.getOrCreateServer();
        await serverManager.getOrCreateServer();

        // Execution should be called twice
        execution.verifyAll();
        fakeLaunchInfo.verifyAll();
    });
});
