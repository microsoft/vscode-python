// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IServiceManager } from '../ioc/types';
import { CodeCssGenerator } from './codeCssGenerator';
import { DataScience } from './datascience';
import { DataScienceCodeLensProvider } from './editor-integration/codelensprovider';
import { History } from './history';
import { HistoryCommandListener } from './historycommandlistener';
import { HistoryProvider } from './historyProvider';
import { JupyterAvailability } from './jupyterAvailability';
import { JupyterImporter } from './jupyterImporter';
import { JupyterProcess } from './jupyterProcess';
import { JupyterServer } from './jupyterServer';
import {
    ICodeCssGenerator,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IHistory,
    IHistoryProvider,
    IJupyterAvailability,
    INotebookImporter,
    INotebookProcess,
    INotebookServer
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, DataScienceCodeLensProvider);
    serviceManager.addSingleton<IDataScience>(IDataScience, DataScience);
    serviceManager.addSingleton<IJupyterAvailability>(IJupyterAvailability, JupyterAvailability);
    serviceManager.add<IDataScienceCommandListener>(IDataScienceCommandListener, HistoryCommandListener);
    serviceManager.addSingleton<IHistoryProvider>(IHistoryProvider, HistoryProvider);
    serviceManager.add<IHistory>(IHistory, History);
    serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
    serviceManager.add<INotebookServer>(INotebookServer, JupyterServer);
    serviceManager.add<INotebookProcess>(INotebookProcess, JupyterProcess);
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
}
