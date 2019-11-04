// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditorActionTypes } from '../actions';
import { INativeEditorActionMapping } from '../mapping';
import { Creation } from './creation';
import { Effects } from './effects';
import { Execution } from './execution';
import { Kernel } from './kernel';
import { Movement } from './movement';
import { Transfer } from './transfer';
import { Variables } from './variables';
import { CssMessages } from '../../../../client/datascience/messages';

// The list of reducers. 1 per message/action.
export const reducerMap: INativeEditorActionMapping = {
    // State updates
    [NativeEditorActionTypes.INSERT_ABOVE]: Creation.insertAbove,
    [NativeEditorActionTypes.INSERT_ABOVE_FIRST]: Creation.insertAboveFirst,
    [NativeEditorActionTypes.INSERT_BELOW]: Creation.insertBelow,
    [NativeEditorActionTypes.FOCUS_CELL]: Effects.focusCell,
    [NativeEditorActionTypes.UNFOCUS_CELL]: Effects.unfocusCell,
    [NativeEditorActionTypes.ADD_NEW_CELL]: Creation.addNewCell,
    [NativeEditorActionTypes.EXECUTE_CELL]: Execution.executeCell,
    [NativeEditorActionTypes.EXECUTE_ALL_CELLS]: Execution.executeAllCells,
    [NativeEditorActionTypes.EXECUTE_ABOVE]: Execution.executeAbove,
    [NativeEditorActionTypes.EXECUTE_CELL_AND_BELOW]: Execution.executeCellAndBelow,
    [NativeEditorActionTypes.TOGGLE_VARIABLE_EXPLORER]: Variables.toggleVariableExplorer,
    [NativeEditorActionTypes.REFRESH_VARIABLES]: Variables.refreshVariables,
    [NativeEditorActionTypes.RESTART_KERNEL]: Kernel.restartKernel,
    [NativeEditorActionTypes.INTERRUPT_KERNEL]: Kernel.interruptKernel,
    [NativeEditorActionTypes.CLEAR_ALL_OUTPUTS]: Execution.clearAllOutputs,
    [NativeEditorActionTypes.EXPORT]: Transfer.exportCells,
    [NativeEditorActionTypes.SAVE]: Transfer.save,
    [NativeEditorActionTypes.SHOW_DATA_VIEWER]: Transfer.showDataViewer,
    [NativeEditorActionTypes.SEND_COMMAND]: Transfer.sendCommand,
    [NativeEditorActionTypes.SELECT_CELL]: Effects.selectCell,
    [NativeEditorActionTypes.SELECT_NEXT_CELL]: Effects.selectNextCell,
    [NativeEditorActionTypes.MOVE_CELL_UP]: Movement.moveCellUp,
    [NativeEditorActionTypes.MOVE_CELL_DOWN]: Movement.moveCellDown,
    [NativeEditorActionTypes.DELETE_CELL]: Creation.deleteCell,
    [NativeEditorActionTypes.TOGGLE_LINE_NUMBERS]: Effects.toggleLineNumbers,
    [NativeEditorActionTypes.TOGGLE_OUTPUT]: Effects.toggleOutput,
    [NativeEditorActionTypes.CHANGE_CELL_TYPE]: Execution.changeCellType,
    [NativeEditorActionTypes.UNDO]: Execution.undo,
    [NativeEditorActionTypes.ARROW_UP]: Movement.arrowUp,
    [NativeEditorActionTypes.ARROW_DOWN]: Movement.arrowDown,
    [NativeEditorActionTypes.EDIT_CELL]: Execution.editCell,
    [NativeEditorActionTypes.SHOW_PLOT]: Transfer.showPlot,
    [NativeEditorActionTypes.OPEN_LINK]: Transfer.openLink,

    // Messages from the webview (some are ignored)
    [InteractiveWindowMessages.StartCell]: Creation.startCell,
    [InteractiveWindowMessages.FinishCell]: Creation.finishCell,
    [InteractiveWindowMessages.UpdateCell]: Creation.updateCell,
    [InteractiveWindowMessages.NotebookDirty]: Effects.notebookDirty,
    [InteractiveWindowMessages.NotebookClean]: Effects.notebookClean,
    [InteractiveWindowMessages.LoadAllCells]: Creation.loadAllCells,
    [InteractiveWindowMessages.NotebookRunAllCells]: Execution.executeAllCells,
    [InteractiveWindowMessages.NotebookRunSelectedCell]: Execution.executeSelectedCell,
    [InteractiveWindowMessages.NotebookAddCellBelow]: Creation.addNewCell,
    [InteractiveWindowMessages.DoSave]: Transfer.save,
    [InteractiveWindowMessages.DeleteAllCells]: Creation.deleteAllCells,
    [InteractiveWindowMessages.Undo]: Execution.undo,
    [InteractiveWindowMessages.Redo]: Execution.redo,
    [InteractiveWindowMessages.StartProgress]: Effects.startProgress,
    [InteractiveWindowMessages.StopProgress]: Effects.stopProgress,
    [InteractiveWindowMessages.UpdateSettings]: Effects.updateSettings,
    [InteractiveWindowMessages.Activate]: Effects.activate,
    [InteractiveWindowMessages.GetVariablesResponse]: Variables.handleVariablesResponse,
    [InteractiveWindowMessages.GetVariableValueResponse]: Variables.handleVariableResponse,
    [InteractiveWindowMessages.RestartKernel]: Kernel.handleRestarted,
    [CssMessages.GetCssResponse]: Effects.handleCss,
    [InteractiveWindowMessages.MonacoReady]: Effects.monacoReady
}
