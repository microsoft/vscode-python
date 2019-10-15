// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IExtensionSingleActivationService } from '../activation/types';
import { noop } from '../common/utils/misc';
import { StopWatch } from '../common/utils/stopWatch';
import { ClassType, IServiceManager } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { CodeCssGenerator } from './codeCssGenerator';
import { Telemetry } from './constants';
import { DataViewer } from './data-viewing/dataViewer';
import { DataViewerProvider } from './data-viewing/dataViewerProvider';
import { DataScience } from './datascience';
import { DebugLocationTrackerFactory } from './debugLocationTrackerFactory';
import { CellHashProvider } from './editor-integration/cellhashprovider';
import { CodeLensFactory } from './editor-integration/codeLensFactory';
import { DataScienceCodeLensProvider } from './editor-integration/codelensprovider';
import { CodeWatcher } from './editor-integration/codewatcher';
import { Decorator } from './editor-integration/decorator';
import { DataScienceErrorHandler } from './errorHandler/errorHandler';
import { GatherExecution } from './gather/gather';
import { GatherListener } from './gather/gatherListener';
import { DebugListener } from './interactive-common/debugListener';
import { DotNetIntellisenseProvider } from './interactive-common/intellisense/dotNetIntellisenseProvider';
import { JediIntellisenseProvider } from './interactive-common/intellisense/jediIntellisenseProvider';
import { LinkProvider } from './interactive-common/linkProvider';
import { ShowPlotListener } from './interactive-common/showPlotListener';
import { AutoSaveService } from './interactive-ipynb/autoSaveService';
import { NativeEditor } from './interactive-ipynb/nativeEditor';
import { NativeEditorCommandListener } from './interactive-ipynb/nativeEditorCommandListener';
import { NativeEditorProvider } from './interactive-ipynb/nativeEditorProvider';
import { InteractiveWindow } from './interactive-window/interactiveWindow';
import { InteractiveWindowCommandListener } from './interactive-window/interactiveWindowCommandListener';
import { InteractiveWindowProvider } from './interactive-window/interactiveWindowProvider';
import { JupyterCommandFactory } from './jupyter/jupyterCommand';
import { JupyterDebugger } from './jupyter/jupyterDebugger';
import { JupyterExecutionFactory } from './jupyter/jupyterExecutionFactory';
import { JupyterExporter } from './jupyter/jupyterExporter';
import { JupyterImporter } from './jupyter/jupyterImporter';
import { JupyterPasswordConnect } from './jupyter/jupyterPasswordConnect';
import { JupyterServerFactory } from './jupyter/jupyterServerFactory';
import { JupyterSessionManagerFactory } from './jupyter/jupyterSessionManagerFactory';
import { JupyterVariables } from './jupyter/jupyterVariables';
import { PlotViewer } from './plotting/plotViewer';
import { PlotViewerProvider } from './plotting/plotViewerProvider';
import { StatusProvider } from './statusProvider';
import { ThemeFinder } from './themeFinder';
import {
    ICellHashListener,
    ICellHashProvider,
    ICodeCssGenerator,
    ICodeLensFactory,
    ICodeWatcher,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IDataScienceErrorHandler,
    IDataViewer,
    IDataViewerProvider,
    IDebugLocationTracker,
    IGatherExecution,
    IInteractiveWindow,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterCommandFactory,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterPasswordConnect,
    IJupyterSessionManagerFactory,
    IJupyterVariables,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExecutionLogger,
    INotebookExporter,
    INotebookImporter,
    INotebookServer,
    IPlotViewer,
    IPlotViewerProvider,
    IStatusProvider,
    IThemeFinder
} from './types';

// tslint:disable:no-any
function wrapType(ctor: ClassType<any>): ClassType<any> {
    return class extends ctor {
        constructor(...args: any[]) {
            const stopWatch = new StopWatch();
            super(...args);
            try {
                // ctor name is minified. compute from the class definition
                const className = ctor.toString().match(/\w+/g)![1];
                sendTelemetryEvent(Telemetry.ClassConstructionTime, stopWatch.elapsedTime, { class: className });
            } catch {
                noop();
            }
        }
    };
}

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, wrapType(DataScienceCodeLensProvider));
    serviceManager.addSingleton<IDataScience>(IDataScience, wrapType(DataScience));
    serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, wrapType(JupyterExecutionFactory));
    serviceManager.addSingleton<IDataScienceCommandListener>(IDataScienceCommandListener, wrapType(InteractiveWindowCommandListener));
    serviceManager.addSingleton<IInteractiveWindowProvider>(IInteractiveWindowProvider, wrapType(InteractiveWindowProvider));
    serviceManager.add<IInteractiveWindow>(IInteractiveWindow, wrapType(InteractiveWindow));
    serviceManager.add<INotebookExporter>(INotebookExporter, wrapType(JupyterExporter));
    serviceManager.add<INotebookImporter>(INotebookImporter, wrapType(JupyterImporter));
    serviceManager.add<INotebookServer>(INotebookServer, wrapType(JupyterServerFactory));
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, wrapType(CodeCssGenerator));
    serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, wrapType(JupyterPasswordConnect));
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, wrapType(StatusProvider));
    serviceManager.addSingleton<IJupyterSessionManagerFactory>(IJupyterSessionManagerFactory, wrapType(JupyterSessionManagerFactory));
    serviceManager.addSingleton<IJupyterVariables>(IJupyterVariables, wrapType(JupyterVariables));
    serviceManager.add<ICodeWatcher>(ICodeWatcher, wrapType(CodeWatcher));
    serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, wrapType(JupyterCommandFactory));
    serviceManager.addSingleton<IThemeFinder>(IThemeFinder, wrapType(ThemeFinder));
    serviceManager.addSingleton<IDataViewerProvider>(IDataViewerProvider, wrapType(DataViewerProvider));
    serviceManager.add<IDataViewer>(IDataViewer, wrapType(DataViewer));
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, wrapType(Decorator));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(DotNetIntellisenseProvider));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(JediIntellisenseProvider));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(LinkProvider));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(ShowPlotListener));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(DebugListener));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(GatherListener));
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, wrapType(AutoSaveService));
    serviceManager.addSingleton<IPlotViewerProvider>(IPlotViewerProvider, wrapType(PlotViewerProvider));
    serviceManager.add<IPlotViewer>(IPlotViewer, wrapType(PlotViewer));
    serviceManager.addSingleton<IJupyterDebugger>(IJupyterDebugger, wrapType(JupyterDebugger));
    serviceManager.add<IDataScienceErrorHandler>(IDataScienceErrorHandler, wrapType(DataScienceErrorHandler));
    serviceManager.addSingleton<ICodeLensFactory>(ICodeLensFactory, wrapType(CodeLensFactory));
    serviceManager.addSingleton<ICellHashProvider>(ICellHashProvider, wrapType(CellHashProvider));
    serviceManager.addSingleton<IGatherExecution>(IGatherExecution, wrapType(GatherExecution));
    serviceManager.addBinding(ICellHashProvider, IInteractiveWindowListener);
    serviceManager.addBinding(ICellHashProvider, INotebookExecutionLogger);
    serviceManager.addBinding(IJupyterDebugger, ICellHashListener);
    serviceManager.addSingleton<INotebookEditorProvider>(INotebookEditorProvider, wrapType(NativeEditorProvider));
    serviceManager.add<INotebookEditor>(INotebookEditor, wrapType(NativeEditor));
    serviceManager.addSingleton<IDataScienceCommandListener>(IDataScienceCommandListener, wrapType(NativeEditorCommandListener));
    serviceManager.addBinding(IGatherExecution, INotebookExecutionLogger);
    serviceManager.addBinding(ICodeLensFactory, IInteractiveWindowListener);
    serviceManager.addSingleton<IDebugLocationTracker>(IDebugLocationTracker, wrapType(DebugLocationTrackerFactory));
}
