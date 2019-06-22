import { JupyterLab, JupyterLabPlugin } from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/coreutils';
import { DocumentManager, IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { JSONObject, JSONExt, JSONArray } from '@phosphor/coreutils';
import { DisposableDelegate, IDisposable } from '@phosphor/disposable';
import { Widget } from '@phosphor/widgets';
import '../../style/index.css';
import { DataflowAnalyzer } from '../analysis/slice/dataFlow';
import { ExecutionLogSlicer } from '../analysis/slice/logSlicer';
import { GatherController, GatherModel, GatherState, SliceSelection } from '../model';
import { GatherModelRegistry, getGatherModelForActiveNotebook } from '../model/gather-registry';
import { CellChangeListener } from '../overlay/cell-listener';
import { MarkerManager } from '../overlay/gather-markers';
import { NotifactionExtension as NotificationExtension } from '../overlay/notification';
import { RevisionBrowser } from '../overlay/revision-browser';
import { initToolbar } from '../overlay/toolbar';
import { loadHistory } from '../persistence/load';
import { storeHistory } from '../persistence/store';
import { initLogger, log } from '../util/log';
import { ExecutionLogger } from './execution-logger';
import { Clipboard } from './gather-actions';
import { SliceConfiguration } from '../analysis/slice/slice-config';
import { IGatherModel } from '../../types';

const extension: JupyterLabPlugin<void> = {
    activate: activateExtension,
    id: 'gather:gatherPlugin',
    requires: [ICommandPalette, INotebookTracker, IDocumentManager, ISettingRegistry],
    autoStart: true
};

/**
 * Extension for tracking sequences of cells executed in a notebook.
 * TODO(andrewhead): can we run the analysis on the backend with a web-worker (specifically, def-use?)
 */
export class CodeGatheringExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    constructor(app: JupyterLab, documentManager: DocumentManager, settingRegistry: ISettingRegistry, notebooks: INotebookTracker, gatherModelRegistry: GatherModelRegistry) {
        this._app = app;
        this._documentManager = documentManager;
        this._notebooks = notebooks;
        this._gatherModelRegistry = gatherModelRegistry;
        settingRegistry.get('nbgather:plugin', 'rules').then(data => {
            if (JSONExt.isArray(data.composite)) {
                let dataCompositeObject = data.composite as JSONArray;
                this._sliceConfiguration = dataCompositeObject as SliceConfiguration;
            }
        });
    }

    createNew(notebook: NotebookPanel, notebookContext: DocumentRegistry.IContext<INotebookModel>): IDisposable {
        /*
         * For the metadata to be available, first wait for the context to be "ready.""
         */
        notebookContext.ready.then(() => {
            /*
             * The order of operations here is key. First, create a model that contains a log of
             * executed cells and the state of the gather UI.
             */
            let notebookModel = notebookContext.model;
            let executionLog = new ExecutionLogSlicer(new DataflowAnalyzer(this._sliceConfiguration));
            const gatherModel: IGatherModel = new GatherModel(executionLog);
            new ExecutionLogger(gatherModel);

            /*
             * Then, initialize reactive UI before loading the execution log from storage. This lets us
             * update the UI automatically as we populate the log.
             */
            this._toolbarWidgets = initToolbar(notebook, gatherModel, this);
            new MarkerManager(gatherModel, notebook);
            new CellChangeListener(gatherModel, notebook);
            new GatherController(gatherModel, this._documentManager, this._notebooks);

            /**
             * Then, load the execution log from the notebook's metadata.
             */
            this._gatherModelRegistry.addGatherModel(notebookModel, gatherModel);
            saveHistoryOnNotebookSave(notebook, gatherModel);
            loadHistory(notebookContext.model, gatherModel);
        });

        return new DisposableDelegate(() => {
            this._toolbarWidgets.forEach(button => button.dispose());
        });
    }

    gatherToClipboard() {
        let gatherModel = getGatherModelForActiveNotebook(this._notebooks, this._gatherModelRegistry);
        if (gatherModel == null) return;
        log('Button: Clicked gather to notebook with selections', {
            selectedDefs: gatherModel.selectedDefs,
            selectedOutputs: gatherModel.selectedOutputs
        });
        gatherModel.addChosenSlices(...gatherModel.selectedSlices.map((sel: SliceSelection) => sel.slice));
        gatherModel.requestStateChange(GatherState.GATHER_TO_CLIPBOARD);
    }

    gatherToNotebook() {
        let gatherModel = getGatherModelForActiveNotebook(this._notebooks, this._gatherModelRegistry);
        if (gatherModel == null) return;
        if (gatherModel.selectedSlices.length >= 1) {
            log('Button: Clicked gather to notebook with selections', {
                selectedDefs: gatherModel.selectedDefs,
                selectedOutputs: gatherModel.selectedOutputs
            });
            gatherModel.addChosenSlices(...gatherModel.selectedSlices.map((sel: SliceSelection) => sel.slice));
            gatherModel.requestStateChange(GatherState.GATHER_TO_NOTEBOOK);
        }
    }

    gatherToScript() {
        let gatherModel = getGatherModelForActiveNotebook(this._notebooks, this._gatherModelRegistry);
        if (gatherModel == null) return;
        if (gatherModel.selectedSlices.length >= 1) {
            log('Button: Clicked gather to script with selections', {
                selectedDefs: gatherModel.selectedDefs,
                selectedOutputs: gatherModel.selectedOutputs
            });
            gatherModel.addChosenSlices(...gatherModel.selectedSlices.map((sel: SliceSelection) => sel.slice));
            gatherModel.requestStateChange(GatherState.GATHER_TO_SCRIPT);
        }
    }

    gatherRevisions() {
        let gatherModel = getGatherModelForActiveNotebook(this._notebooks, this._gatherModelRegistry);
        let revisionBrowser = new RevisionBrowser(gatherModel);
        this._app.shell.addToMainArea(revisionBrowser);
        this._app.shell.activateById(revisionBrowser.id);
    }

    private _toolbarWidgets: Widget[];
    private _app: JupyterLab;
    private _documentManager: DocumentManager;
    private _notebooks: INotebookTracker;
    private _sliceConfiguration: SliceConfiguration;
    private _gatherModelRegistry: GatherModelRegistry;
}

function saveHistoryOnNotebookSave(notebook: NotebookPanel, gatherModel: GatherModel) {
    notebook.context.saveState.connect((_, message) => {
        if (message == 'started') {
            storeHistory(notebook.model, gatherModel.executionLog);
        }
    });
}

function activateExtension(app: JupyterLab, palette: ICommandPalette, notebooks: INotebookTracker, documentManager: IDocumentManager, settingRegistry: ISettingRegistry) {
    console.log('Activating code gathering tools...');

    const notificationExtension = new NotificationExtension();
    app.docRegistry.addWidgetExtension('Notebook', notificationExtension);
    Clipboard.getInstance().copied.connect(() => {
        notificationExtension.showMessage("Copied cells to clipboard. Type 'V' to paste.");
    });

    let gatherModelRegistry = new GatherModelRegistry();
    let codeGatheringExtension = new CodeGatheringExtension(app, documentManager, settingRegistry, notebooks, gatherModelRegistry);
    app.docRegistry.addWidgetExtension('Notebook', codeGatheringExtension);

    function addCommand(command: string, label: string, execute: (options?: JSONObject) => void) {
        app.commands.addCommand(command, { label, execute });
        palette.addItem({ command, category: 'Clean Up' });
    }

    addCommand('gather:gatherToClipboard', 'Gather this result to the clipboard', () => {
        codeGatheringExtension.gatherToClipboard();
    });

    addCommand('gather:gatherToNotebook', 'Gather this result into a new notebook', () => {
        codeGatheringExtension.gatherToNotebook();
    });

    addCommand('gather:gatherToScript', 'Gather this result into a new script', () => {
        codeGatheringExtension.gatherToScript();
    });

    addCommand('gather:gatherFromHistory', 'Compare previous versions of this result', () => {
        codeGatheringExtension.gatherRevisions();
    });

    initLogger(settingRegistry);
    console.log('Gathering tools have been activated.');
}

export default extension;
