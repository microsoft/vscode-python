// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as TypeMoq from 'typemoq';
import { EventEmitter, Uri, WorkspaceConfiguration } from 'vscode';

import { IApplicationShell, IDocumentManager, IWorkspaceService } from '../../client/common/application/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { IConfigurationService, ICurrentProcess, ILogger, IPythonSettings } from '../../client/common/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { History } from '../../client/datascience/history';
import { HistoryProvider } from '../../client/datascience/historyProvider';
import { JupyterExecution } from '../../client/datascience/jupyterExecution';
import { JupyterImporter } from '../../client/datascience/jupyterImporter';
import { JupyterProcess } from '../../client/datascience/jupyterProcess';
import { JupyterServer } from '../../client/datascience/jupyterServer';
import { StatusProvider } from '../../client/datascience/statusProvider';
import {
    ICodeCssGenerator,
    IHistory,
    IHistoryProvider,
    IJupyterExecution,
    INotebookImporter,
    INotebookProcess,
    INotebookServer,
    IStatusProvider
} from '../../client/datascience/types';
import { ICondaService, IInterpreterService } from '../../client/interpreter/contracts';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { MockPythonExecutionService } from './executionServiceMock';

export class DataScienceIocContainer extends UnitTestIocContainer {
    constructor() {
        super();
    }

    public registerDataScienceTypes() {
        this.registerFileSystemTypes();
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecution);
        this.serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
        this.serviceManager.add<IHistory>(IHistory, History);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServer);
        this.serviceManager.add<INotebookProcess>(INotebookProcess, JupyterProcess);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
        this.serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);

        // Also setup a mock execution service and interpreter service
        const logger = TypeMoq.Mock.ofType<ILogger>();
        const pythonExecutionService = new MockPythonExecutionService();
        const factory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
        const interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        const condaService = TypeMoq.Mock.ofType<ICondaService>();
        const appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        const currentProcess = new CurrentProcess();
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();

        this.serviceManager.addSingletonInstance<ILogger>(ILogger, logger.object);
        this.serviceManager.addSingletonInstance<IPythonExecutionFactory>(IPythonExecutionFactory, factory.object);
        this.serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);
        this.serviceManager.addSingletonInstance<ICondaService>(ICondaService, condaService.object);
        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        this.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, documentManager.object);
        this.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspaceService.object);
        this.serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configurationService.object);
        this.serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, currentProcess);

        const dummyDisposable = {
            dispose: () => { return; }
        };

        appShell.setup(a => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(Uri.file('')));
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);

        factory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService));
        const e = new EventEmitter<void>();
        interpreterService.setup(x => x.onDidChangeInterpreter).returns(() => e.event);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceService.setup(c => c.getConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => workspaceConfig.object);
        workspaceConfig.setup(c => c.get(TypeMoq.It.isAny())).returns(() => undefined);

        // tslint:disable-next-line:no-empty
        logger.setup(l => l.logInformation(TypeMoq.It.isAny())).returns((m) => {}); // console.log(m)); // REnable this to debug the server

    }
}
