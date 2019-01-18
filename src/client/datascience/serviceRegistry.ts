// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IServiceManager } from '../ioc/types';
import { CodeCssGenerator } from './codeCssGenerator';
import { DataScience } from './datascience';
import { DataScienceCodeLensProvider } from './editor-integration/codelensprovider';
import { CodeWatcher } from './editor-integration/codewatcher';
import { History } from './history';
import { HistoryCommandListener } from './historycommandlistener';
import { HistoryProvider } from './historyProvider';
import { JupyterCommandFactory } from './jupyter/jupyterCommand';
import { JupyterExecution } from './jupyter/jupyterExecution';
import { JupyterExporter } from './jupyter/jupyterExporter';
import { JupyterImporter } from './jupyter/jupyterImporter';
import { JupyterServer } from './jupyter/jupyterServer';
import { JupyterSessionManager } from './jupyter/jupyterSessionManager';
import { StatusProvider } from './statusProvider';
import {
    ICodeCssGenerator,
    ICodeWatcher,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IHistory,
    IHistoryProvider,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterSessionManager,
    INotebookExporter,
    INotebookImporter,
    INotebookServer,
    IStatusProvider
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, DataScienceCodeLensProvider);
    serviceManager.addSingleton<IDataScience>(IDataScience, DataScience);
    serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecution);
    serviceManager.add<IDataScienceCommandListener>(IDataScienceCommandListener, HistoryCommandListener);
    serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
    serviceManager.add<IHistory>(IHistory, History);
    serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
    serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
    serviceManager.add<INotebookServer>(INotebookServer, JupyterServer);
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
    serviceManager.addSingleton<IJupyterSessionManager>(IJupyterSessionManager, JupyterSessionManager);
    serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
    serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
}
