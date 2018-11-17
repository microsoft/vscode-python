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
import { JupyterExecution } from './jupyterExecution';
import { JupyterImporter } from './jupyterImporter';
import { JupyterServer } from './jupyterServer';
import { StatusProvider } from './statusProvider';
import {
    ICodeCssGenerator,
    ICodeWatcher,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IHistory,
    IHistoryProvider,
    IJupyterExecution,
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
    serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
    serviceManager.add<INotebookServer>(INotebookServer, JupyterServer);
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
    serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
}
