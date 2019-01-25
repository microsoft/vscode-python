// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export namespace Commands {
    export const RunAllCells = 'python.datascience.runallcells';
    export const RunCell = 'python.datascience.runcell';
    export const RunCurrentCell = 'python.datascience.runcurrentcell';
    export const RunCurrentCellAdvance = 'python.datascience.runcurrentcelladvance';
    export const ShowHistoryPane = 'python.datascience.showhistorypane';
    export const ImportNotebook = 'python.datascience.importnotebook';
    export const SelectJupyterURI = 'python.datascience.selectjupyteruri';
    export const ExportFileAsNotebook = 'python.datascience.exportfileasnotebook';
    export const ExportFileAndOutputAsNotebook = 'python.datascience.exportfileandoutputasnotebook';
    export const UndoCells = 'python.datascience.undocells';
    export const RedoCells = 'python.datascience.redocells';
    export const RemoveAllCells = 'python.datascience.removeallcells';
    export const InterruptKernel = 'python.datascience.interruptkernel';
    export const RestartKernel = 'python.datascience.restartkernel';
    export const ExpandAllCells = 'python.datascience.expandallcells';
    export const CollapseAllCells = 'python.datascience.collapseallcells';
    export const ExportOutputAsNotebook = 'python.datascience.exportoutputasnotebook';
    export const ExecSelectionInInteractiveWindow = 'python.datascience.execSelectionInteractive';
}

export namespace EditorContexts {
    export const HasCodeCells = 'python.datascience.hascodecells';
    export const DataScienceEnabled = 'python.datascience.featureenabled';
    export const HaveInteractiveCells = 'python.datascience.haveinteractivecells';
    export const HaveRedoableCells = 'python.datascience.haveredoablecells';
    export const HaveInteractive = 'python.datascience.haveinteractive';
    export const OwnsSelection = 'python.datascience.ownsSelection';
}

export namespace RegExpValues {
    export const PythonCellMarker = new RegExp('^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])(.*)');
    export const PythonMarkdownCellMarker = /^#\s*%%\s*\[markdown\]/;
}

export namespace HistoryMessages {
    export const StartCell = 'start_cell';
    export const FinishCell = 'finish_cell';
    export const UpdateCell = 'update_cell';
    export const GotoCodeCell = 'gotocell_code';
    export const RestartKernel = 'restart_kernel';
    export const Export = 'export_to_ipynb';
    export const GetAllCells = 'get_all_cells';
    export const ReturnAllCells = 'return_all_cells';
    export const DeleteCell = 'delete_cell';
    export const DeleteAllCells = 'delete_all_cells';
    export const Undo = 'undo';
    export const Redo = 'redo';
    export const ExpandAll = 'expand_all';
    export const CollapseAll = 'collapse_all';
    export const StartProgress = 'start_progress';
    export const StopProgress = 'stop_progress';
    export const Interrupt = 'interrupt';
    export const SendInfo = 'send_info';
    export const SubmitNewCell = 'submit_new_cell';
    export const UpdateSettings = 'update_settings';
}

export enum Telemetry {
    ImportNotebook = 'DATASCIENCE.IMPORT_NOTEBOOK',
    RunCell = 'DATASCIENCE.RUN_CELL',
    RunCurrentCell = 'DATASCIENCE.RUN_CURRENT_CELL',
    RunCurrentCellAndAdvance = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADVANCE',
    RunAllCells = 'DATASCIENCE.RUN_ALL_CELLS',
    RunSelectionOrLine = 'DATASCIENCE.RUN_SELECTION_OR_LINE',
    DeleteAllCells = 'DATASCIENCE.DELETE_ALL_CELLS',
    DeleteCell = 'DATASCIENCE.DELETE_CELL',
    GotoSourceCode = 'DATASCIENCE.GOTO_SOURCE',
    RestartKernel = 'DATASCIENCE.RESTART_KERNEL',
    ExportNotebook = 'DATASCIENCE.EXPORT_NOTEBOOK',
    Undo = 'DATASCIENCE.UNDO',
    Redo = 'DATASCIENCE.REDO',
    ShowHistoryPane = 'DATASCIENCE.SHOW_HISTORY_PANE',
    ExpandAll = 'DATASCIENCE.EXPAND_ALL',
    CollapseAll = 'DATASCIENCE.COLLAPSE_ALL',
    SelectJupyterURI = 'DATASCIENCE.SELECT_JUPYTER_URI',
    SetJupyterURIToLocal = 'DATASCIENCE.SET_JUPYTER_URI_LOCAL',
    SetJupyterURIToUserSpecified = 'DATASCIENCE.SET_JUPYTER_URI_USER_SPECIFIED',
    Interrupt = 'DATASCIENCE.INTERRUPT',
    ExportPythonFile = 'DATASCIENCE.EXPORT_PYTHON_FILE',
    ExportPythonFileAndOutput = 'DATASCIENCE.EXPORT_PYTHON_FILE_AND_OUTPUT',
    StartJupyter = 'DATASCIENCE.JUPYTERSTARTUPCOST',
    SubmitCellThroughInput = 'DATASCIENCE.SUBMITCELLFROMREPL',
    ConnectLocalJupyter = 'DATASCIENCE.CONNECTLOCALJUPYTER',
    ConnectRemoteJupyter = 'DATASCIENCE.CONNECTREMOTEJUPYTER',
    ConnectFailedJupyter = 'DATASCIENCE.CONNECTFAILEDJUPYTER'
}

export namespace HelpLinks {
    export const PythonInteractiveHelpLink = 'https://aka.ms/pyaiinstall';
}

export namespace Settings {
    export const JupyterServerLocalLaunch = 'local';
}

export namespace CodeSnippits {
    export const ChangeDirectory = ['{0}', 'import os', 'try:', '\tos.chdir(os.path.join(os.getcwd(), \'{1}\'))', '\tprint(os.getcwd())', 'except:', '\tpass', ''];
}

export namespace Identifiers {
    export const EmptyFileName = '2DB9B899-6519-4E1B-88B0-FA728A274115';
    export const GeneratedThemeName = 'ipython-theme'; // This needs to be all lower class and a valid class name.
}
