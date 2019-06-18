// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IExtensionActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { CodeCssGenerator } from './codeCssGenerator';
import { DataViewer } from './data-viewing/dataViewer';
import { DataViewerProvider } from './data-viewing/dataViewerProvider';
import { DataScience } from './datascience';
import { DataScienceCodeLensProvider } from './editor-integration/codelensprovider';
import { CodeWatcher } from './editor-integration/codewatcher';
import { Decorator } from './editor-integration/decorator';
import { DotNetIntellisenseProvider } from './interactive-window/intellisense/dotNetIntellisenseProvider';
import { JediIntellisenseProvider } from './interactive-window/intellisense/jediIntellisenseProvider';
import { InteractiveWindow } from './interactive-window/interactiveWindow';
import { InteractiveWindowCommandListener } from './interactive-window/interactiveWindowCommandListener';
import { InteractiveWindowProvider } from './interactive-window/interactiveWindowProvider';
import { LinkProvider } from './interactive-window/linkProvider';
import { ShowPlotListener } from './interactive-window/showPlotListener';
import { JupyterCommandFactory } from './jupyter/jupyterCommand';
import { JupyterExecutionFactory } from './jupyter/jupyterExecutionFactory';
import { JupyterExporter } from './jupyter/jupyterExporter';
import { JupyterImporter } from './jupyter/jupyterImporter';
import { JupyterPasswordConnect } from './jupyter/jupyterPasswordConnect';
import { JupyterServerFactory } from './jupyter/jupyterServerFactory';
import { JupyterSessionManager } from './jupyter/jupyterSessionManager';
import { JupyterVariables } from './jupyter/jupyterVariables';
import { PlotViewer } from './plotting/plotViewer';
import { PlotViewerProvider } from './plotting/plotViewerProvider';
import { StatusProvider } from './statusProvider';
import { ThemeFinder } from './themeFinder';
import {
    ICodeCssGenerator,
    ICodeWatcher,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IDataViewer,
    IDataViewerProvider,
    IInteractiveWindow,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterCommandFactory,
    IJupyterExecution,
    IJupyterPasswordConnect,
    IJupyterSessionManager,
    IJupyterVariables,
    INotebookExporter,
    INotebookImporter,
    INotebookServer,
    IPlotViewer,
    IPlotViewerProvider,
    IStatusProvider,
    IThemeFinder
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, DataScienceCodeLensProvider);
    serviceManager.addSingleton<IDataScience>(IDataScience, DataScience);
    serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
    serviceManager.add<IDataScienceCommandListener>(IDataScienceCommandListener, InteractiveWindowCommandListener);
    serviceManager.addSingleton<IInteractiveWindowProvider>(IInteractiveWindowProvider, InteractiveWindowProvider);
    serviceManager.add<IInteractiveWindow>(IInteractiveWindow, InteractiveWindow);
    serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
    serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
    serviceManager.add<INotebookServer>(INotebookServer, JupyterServerFactory);
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
    serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, JupyterPasswordConnect);
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
    serviceManager.addSingleton<IJupyterSessionManager>(IJupyterSessionManager, JupyterSessionManager);
    serviceManager.addSingleton<IJupyterVariables>(IJupyterVariables, JupyterVariables);
    serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
    serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
    serviceManager.addSingleton<IThemeFinder>(IThemeFinder, ThemeFinder);
    serviceManager.addSingleton<IDataViewerProvider>(IDataViewerProvider, DataViewerProvider);
    serviceManager.add<IDataViewer>(IDataViewer, DataViewer);
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, Decorator);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, DotNetIntellisenseProvider);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, JediIntellisenseProvider);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, LinkProvider);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, ShowPlotListener);
    serviceManager.addSingleton<IPlotViewerProvider>(IPlotViewerProvider, PlotViewerProvider);
    serviceManager.add<IPlotViewer>(IPlotViewer, PlotViewer);
}
