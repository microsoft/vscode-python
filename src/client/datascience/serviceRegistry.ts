// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IExtensionSingleActivationService } from '../activation/types';
import { IWorkspaceService } from '../common/application/types';
import { IServiceManager } from '../ioc/types';
import { Activation } from './activation';
import { CodeCssGenerator } from './codeCssGenerator';
import { CommandRegistry } from './commands/commandRegistry';
import { KernelSwitcherCommand } from './commands/kernelSwitcher';
import { JupyterServerSelectorCommand } from './commands/serverSelector';
import { ActiveEditorContextService } from './context/activeEditorContext';
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
import { IntellisenseProvider } from './interactive-common/intellisense/intellisenseProvider';
import { LinkProvider } from './interactive-common/linkProvider';
import { ShowPlotListener } from './interactive-common/showPlotListener';
import { AutoSaveService } from './interactive-ipynb/autoSaveService';
import { NativeEditor } from './interactive-ipynb/nativeEditor';
import { NativeEditorCommandListener } from './interactive-ipynb/nativeEditorCommandListener';
import { NativeEditorProvider } from './interactive-ipynb/nativeEditorProvider';
import { InteractiveWindow } from './interactive-window/interactiveWindow';
import { InteractiveWindowCommandListener } from './interactive-window/interactiveWindowCommandListener';
import { InteractiveWindowProvider } from './interactive-window/interactiveWindowProvider';
import { JupyterCommandFactory } from './jupyter/interpreter/jupyterCommand';
import { JupyterCommandFinder } from './jupyter/interpreter/jupyterCommandFinder';
import { JupyterCommandInterpreterDependencyService } from './jupyter/interpreter/jupyterCommandInterpreterDependencyService';
import { JupyterCommandFinderInterpreterExecutionService } from './jupyter/interpreter/jupyterCommandInterpreterExecutionService';
import { JupyterInterpreterDependencyService } from './jupyter/interpreter/jupyterInterpreterDependencyService';
import { JupyterInterpreterOldCacheStateStore } from './jupyter/interpreter/jupyterInterpreterOldCacheStateStore';
import { JupyterInterpreterSelectionCommand } from './jupyter/interpreter/jupyterInterpreterSelectionCommand';
import { JupyterInterpreterSelector } from './jupyter/interpreter/jupyterInterpreterSelector';
import { JupyterInterpreterService } from './jupyter/interpreter/jupyterInterpreterService';
import { JupyterInterpreterStateStore } from './jupyter/interpreter/jupyterInterpreterStateStore';
import { JupyterInterpreterSubCommandExecutionService } from './jupyter/interpreter/jupyterInterpreterSubCommandExecutionService';
import { JupyterDebugger } from './jupyter/jupyterDebugger';
import { JupyterExecutionFactory } from './jupyter/jupyterExecutionFactory';
import { JupyterExporter } from './jupyter/jupyterExporter';
import { JupyterImporter } from './jupyter/jupyterImporter';
import { JupyterPasswordConnect } from './jupyter/jupyterPasswordConnect';
import { JupyterServerWrapper } from './jupyter/jupyterServerWrapper';
import { JupyterSessionManagerFactory } from './jupyter/jupyterSessionManagerFactory';
import { JupyterVariables } from './jupyter/jupyterVariables';
import { KernelSelectionProvider } from './jupyter/kernels/kernelSelections';
import { KernelSelector } from './jupyter/kernels/kernelSelector';
import { KernelService } from './jupyter/kernels/kernelService';
import { KernelSwitcher } from './jupyter/kernels/kernelSwitcher';
import { NotebookStarter } from './jupyter/notebookStarter';
import { ServerPreload } from './jupyter/serverPreload';
import { JupyterServerSelector } from './jupyter/serverSelector';
import { PlotViewer } from './plotting/plotViewer';
import { PlotViewerProvider } from './plotting/plotViewerProvider';
import { PreWarmActivatedJupyterEnvironmentVariables } from './preWarmVariables';
import { ProgressReporter } from './progress/progressReporter';
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
    IJupyterInterpreterDependencyManager,
    IJupyterPasswordConnect,
    IJupyterSessionManagerFactory,
    IJupyterSubCommandExecutionService,
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

// tslint:disable-next-line: max-func-body-length
export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDataScienceCodeLensProvider>(
        IDataScienceCodeLensProvider,
        DataScienceCodeLensProvider
    );
    serviceManager.addSingleton<IDataScience>(IDataScience, DataScience);
    serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
    serviceManager.addSingleton<IDataScienceCommandListener>(
        IDataScienceCommandListener,
        InteractiveWindowCommandListener
    );
    serviceManager.addSingleton<IInteractiveWindowProvider>(IInteractiveWindowProvider, InteractiveWindowProvider);
    serviceManager.add<IInteractiveWindow>(IInteractiveWindow, InteractiveWindow);
    serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
    serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
    serviceManager.add<INotebookServer>(INotebookServer, JupyterServerWrapper);
    serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
    serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, JupyterPasswordConnect);
    serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
    serviceManager.addSingleton<IJupyterSessionManagerFactory>(
        IJupyterSessionManagerFactory,
        JupyterSessionManagerFactory
    );
    serviceManager.addSingleton<IJupyterVariables>(IJupyterVariables, JupyterVariables);
    serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
    serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
    serviceManager.addSingleton<IThemeFinder>(IThemeFinder, ThemeFinder);
    serviceManager.addSingleton<IDataViewerProvider>(IDataViewerProvider, DataViewerProvider);
    serviceManager.add<IDataViewer>(IDataViewer, DataViewer);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, Decorator);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, IntellisenseProvider);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, LinkProvider);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, ShowPlotListener);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, DebugListener);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, GatherListener);
    serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, AutoSaveService);
    serviceManager.addSingleton<IPlotViewerProvider>(IPlotViewerProvider, PlotViewerProvider);
    serviceManager.add<IPlotViewer>(IPlotViewer, PlotViewer);
    serviceManager.addSingleton<IJupyterDebugger>(IJupyterDebugger, JupyterDebugger);
    serviceManager.add<IDataScienceErrorHandler>(IDataScienceErrorHandler, DataScienceErrorHandler);
    serviceManager.addSingleton<ICodeLensFactory>(ICodeLensFactory, CodeLensFactory);
    serviceManager.addSingleton<ICellHashProvider>(ICellHashProvider, CellHashProvider);
    serviceManager.add<IGatherExecution>(IGatherExecution, GatherExecution);
    serviceManager.addBinding(ICellHashProvider, IInteractiveWindowListener);
    serviceManager.addBinding(ICellHashProvider, INotebookExecutionLogger);
    serviceManager.addBinding(IJupyterDebugger, ICellHashListener);
    serviceManager.addSingleton<INotebookEditorProvider>(INotebookEditorProvider, NativeEditorProvider);
    serviceManager.add<INotebookEditor>(INotebookEditor, NativeEditor);
    serviceManager.addSingleton<IDataScienceCommandListener>(IDataScienceCommandListener, NativeEditorCommandListener);
    serviceManager.addBinding(ICodeLensFactory, IInteractiveWindowListener);
    serviceManager.addSingleton<IDebugLocationTracker>(IDebugLocationTracker, DebugLocationTrackerFactory);
    serviceManager.addSingleton<JupyterCommandFinder>(JupyterCommandFinder, JupyterCommandFinder);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, Activation);
    serviceManager.addSingleton<KernelService>(KernelService, KernelService);
    serviceManager.addSingleton<NotebookStarter>(NotebookStarter, NotebookStarter);
    serviceManager.addSingleton<KernelSelector>(KernelSelector, KernelSelector);
    serviceManager.addSingleton<KernelSelectionProvider>(KernelSelectionProvider, KernelSelectionProvider);
    serviceManager.addSingleton<CommandRegistry>(CommandRegistry, CommandRegistry);
    serviceManager.addSingleton<JupyterServerSelectorCommand>(
        JupyterServerSelectorCommand,
        JupyterServerSelectorCommand
    );
    serviceManager.addSingleton<KernelSwitcherCommand>(KernelSwitcherCommand, KernelSwitcherCommand);
    serviceManager.addSingleton<KernelSwitcher>(KernelSwitcher, KernelSwitcher);
    serviceManager.addSingleton<JupyterServerSelector>(JupyterServerSelector, JupyterServerSelector);
    serviceManager.addSingleton<JupyterInterpreterStateStore>(
        JupyterInterpreterStateStore,
        JupyterInterpreterStateStore
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        JupyterInterpreterSelectionCommand
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        PreWarmActivatedJupyterEnvironmentVariables
    );
    serviceManager.addSingleton<JupyterInterpreterSelector>(JupyterInterpreterSelector, JupyterInterpreterSelector);
    serviceManager.addSingleton<JupyterInterpreterDependencyService>(
        JupyterInterpreterDependencyService,
        JupyterInterpreterDependencyService
    );
    serviceManager.addSingleton<JupyterInterpreterService>(JupyterInterpreterService, JupyterInterpreterService);
    serviceManager.addSingleton<JupyterInterpreterOldCacheStateStore>(
        JupyterInterpreterOldCacheStateStore,
        JupyterInterpreterOldCacheStateStore
    );
    serviceManager.addSingleton<ActiveEditorContextService>(ActiveEditorContextService, ActiveEditorContextService);
    serviceManager.addSingleton<ProgressReporter>(ProgressReporter, ProgressReporter);
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, ServerPreload);

    // Temporary code, to allow users to revert to the old behavior.
    const cfg = serviceManager
        .get<IWorkspaceService>(IWorkspaceService)
        .getConfiguration('python.dataScience', undefined);
    if (cfg.get<boolean>('useOldJupyterServer', false)) {
        serviceManager.addSingleton<IJupyterSubCommandExecutionService>(
            IJupyterSubCommandExecutionService,
            JupyterCommandFinderInterpreterExecutionService
        );
        serviceManager.addSingleton<IJupyterInterpreterDependencyManager>(
            IJupyterInterpreterDependencyManager,
            JupyterCommandInterpreterDependencyService
        );
    } else {
        serviceManager.addSingleton<IJupyterSubCommandExecutionService>(
            IJupyterSubCommandExecutionService,
            JupyterInterpreterSubCommandExecutionService
        );
        serviceManager.addSingleton<IJupyterInterpreterDependencyManager>(
            IJupyterInterpreterDependencyManager,
            JupyterInterpreterSubCommandExecutionService
        );
    }
}
