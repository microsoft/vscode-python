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
}

export namespace EditorContexts {
    export const HasCodeCells = 'python.datascience.hascodecells';
    export const DataScienceEnabled = 'python.datascience.featureenabled';
}

export namespace RegExpValues {
    export const PythonCellMarker = new RegExp('^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])(.*)');
    export const PythonMarkdownCellMarker = /^#\s*%%\s*\[markdown\]/;
}

export namespace HistoryMessages {
    export const StartCell = 'start_cell';
    export const FinishCell = 'finish_cell';
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
}

export namespace Telemetry {
    export const ImportNotebook = 'DATASCIENCE.IMPORT_NOTEBOOK';
    export const RunCell = 'DATASCIENCE.RUN_CELL';
    export const RunCurrentCell = 'DATASCIENCE.RUN_CURRENT_CELL';
    export const RunCurrentCellAndAdvance = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADVANCE';
    export const RunAllCells = 'DATASCIENCE.RUN_ALL_CELLS';
    export const DeleteAllCells = 'DATASCIENCE.DELETE_ALL_CELLS';
    export const DeleteCell = 'DATASCIENCE.DELETE_CELL';
    export const GotoSourceCode = 'DATASCIENCE.GOTO_SOURCE';
    export const RestartKernel = 'DATASCIENCE.RESTART_KERNEL';
    export const ExportNotebook = 'DATASCIENCE.EXPORT_NOTEBOOK';
    export const Undo = 'DATASCIENCE.UNDO';
    export const Redo = 'DATASCIENCE.REDO';
    export const ShowHistoryPane = 'DATASCIENCE.SHOW_HISTORY_PANE';
    export const ExpandAll = 'DATASCIENCE.EXPAND_ALL';
    export const CollapseAll = 'DATASCIENCE.COLLAPSE_ALL';
}
