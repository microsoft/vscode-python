// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IExtensionActivationService } from '../activation/types';
import { StopWatch } from '../common/utils/stopWatch';
import { ClassType, IServiceManager } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { CodeCssGenerator } from './codeCssGenerator';
import { Telemetry } from './constants';
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

// tslint:disable:no-any
function wrapType(ctor: ClassType<any>) : ClassType<any> {
    return class extends ctor {
        constructor(...args: any[]) {
            const stopWatch = new StopWatch();
            super(...args);
            sendTelemetryEvent(Telemetry.ClassConstructionTime, stopWatch.elapsedTime, { class: ctor.name });
        }
    };
}

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, wrapType(DataScienceCodeLensProvider));
    serviceManager.addSingleton<IDataScience>(IDataScience, wrapType(DataScience));
    serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, wrapType(JupyterExecutionFactory));
    serviceManager.add<IDataScienceCommandListener>(IDataScienceCommandListener, wrapType(InteractiveWindowCommandListener));
    serviceManager.addSingleton<IInteractiveWindowProvider>(IInteractiveWindowProvider, wrapType(InteractiveWindowProvider));
    serviceManager.add<IInteractiveWindow>(IInteractiveWindow, wrapType(InteractiveWindow));
    serviceManager.add<INotebookExporter>(INotebookExporter, wrapType(JupyterExporter));
    serviceManager.add<INotebookImporter>(INotebookImporter, wrapType(JupyterImporter));
    serviceManager.add<INotebookServer>(INotebookServer, wrapType(JupyterServerFactory));
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, wrapType(CodeCssGenerator));
    serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, wrapType(JupyterPasswordConnect));
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, wrapType(StatusProvider));
    serviceManager.addSingleton<IJupyterSessionManager>(IJupyterSessionManager, wrapType(JupyterSessionManager));
    serviceManager.addSingleton<IJupyterVariables>(IJupyterVariables, wrapType(JupyterVariables));
    serviceManager.add<ICodeWatcher>(ICodeWatcher, wrapType(CodeWatcher));
    serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, wrapType(JupyterCommandFactory));
    serviceManager.addSingleton<IThemeFinder>(IThemeFinder, wrapType(ThemeFinder));
    serviceManager.addSingleton<IDataViewerProvider>(IDataViewerProvider, wrapType(DataViewerProvider));
    serviceManager.add<IDataViewer>(IDataViewer, wrapType(DataViewer));
    serviceManager.addSingleton<IExtensionActivationService>(IExtensionActivationService, wrapType(Decorator));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(DotNetIntellisenseProvider));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(JediIntellisenseProvider));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(LinkProvider));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(ShowPlotListener));
    serviceManager.addSingleton<IPlotViewerProvider>(IPlotViewerProvider, wrapType(PlotViewerProvider));
    serviceManager.add<IPlotViewer>(IPlotViewer, wrapType(PlotViewer));
}
