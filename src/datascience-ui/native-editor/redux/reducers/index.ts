// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages, SharedMessages } from '../../../../client/datascience/messages';
import { CommonEffects } from '../../../interactive-common/redux/reducers/commonEffects';
import { Kernel } from '../../../interactive-common/redux/reducers/kernel';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { CommonActionType } from '../../../interactive-common/redux/reducers/types';
import { INativeEditorActionMapping } from '../mapping';
import { Creation } from './creation';
import { Effects } from './effects';
import { Execution } from './execution';
import { Movement } from './movement';

// The list of reducers. 1 per message/action.
export const reducerMap: Partial<INativeEditorActionMapping> = {
    // State updates
    [CommonActionType.INSERT_ABOVE_AND_FOCUS_NEW_CELL]: Creation.insertAboveAndFocusCell,
    [CommonActionType.INSERT_ABOVE_FIRST_AND_FOCUS_NEW_CELL]: Creation.insertAboveFirstAndFocusCell,
    [CommonActionType.INSERT_BELOW_AND_FOCUS_NEW_CELL]: Creation.insertBelowAndFocusCell,
    [CommonActionType.INSERT_ABOVE]: Creation.insertNewAbove,
    [CommonActionType.INSERT_ABOVE_FIRST]: Creation.insertAboveFirst,
    [CommonActionType.INSERT_BELOW]: Creation.insertBelow,
    [CommonActionType.FOCUS_CELL]: Effects.focusCell,
    [CommonActionType.UNFOCUS_CELL]: Effects.unfocusCell,
    [CommonActionType.ADD_AND_FOCUS_NEW_CELL]: Creation.addAndFocusCell,
    [CommonActionType.ADD_NEW_CELL]: Creation.addNewCell,
    [CommonActionType.EXECUTE_CELL_AND_ADVANCE]: Execution.executeCellAndAdvance,
    [CommonActionType.EXECUTE_CELL]: Execution.executeCell,
    [CommonActionType.EXECUTE_ALL_CELLS]: Execution.executeAllCells,
    [CommonActionType.EXECUTE_ABOVE]: Execution.executeAbove,
    [CommonActionType.EXECUTE_CELL_AND_BELOW]: Execution.executeCellAndBelow,
    [CommonActionType.RESTART_KERNEL]: Kernel.restartKernel,
    [CommonActionType.INTERRUPT_KERNEL]: Kernel.interruptKernel,
    [InteractiveWindowMessages.ClearAllOutputs]: Execution.clearAllOutputs,
    [CommonActionType.EXPORT]: Transfer.exportCells,
    [CommonActionType.EXPORT_NOTEBOOK_AS]: Transfer.showExportAsMenu,
    [CommonActionType.SAVE]: Transfer.save,
    [CommonActionType.SHOW_DATA_VIEWER]: Transfer.showDataViewer,
    [CommonActionType.SEND_COMMAND]: Transfer.sendCommand,
    [CommonActionType.SELECT_CELL]: Effects.selectCell,
    [InteractiveWindowMessages.SelectKernel]: Kernel.selectKernel,
    [CommonActionType.SELECT_SERVER]: Kernel.selectJupyterURI,
    [CommonActionType.MOVE_CELL_UP]: Movement.moveCellUp,
    [CommonActionType.MOVE_CELL_DOWN]: Movement.moveCellDown,
    [CommonActionType.DELETE_CELL]: Creation.deleteCell,
    [CommonActionType.TOGGLE_LINE_NUMBERS]: Effects.toggleLineNumbers,
    [CommonActionType.TOGGLE_OUTPUT]: Effects.toggleOutput,
    [CommonActionType.CHANGE_CELL_TYPE]: Execution.changeCellType,
    [InteractiveWindowMessages.Undo]: Execution.undo,
    [InteractiveWindowMessages.Redo]: Execution.redo,
    [CommonActionType.ARROW_UP]: Movement.arrowUp,
    [CommonActionType.ARROW_DOWN]: Movement.arrowDown,
    [CommonActionType.EDIT_CELL]: Transfer.editCell,
    [InteractiveWindowMessages.ShowPlot]: Transfer.showPlot,
    [CommonActionType.LINK_CLICK]: Transfer.linkClick,
    [CommonActionType.GATHER_CELL]: Transfer.gather,
    [CommonActionType.GATHER_CELL_TO_SCRIPT]: Transfer.gatherToScript,
    [CommonActionType.EDITOR_LOADED]: Transfer.started,
    [CommonActionType.LOADED_ALL_CELLS]: Transfer.loadedAllCells,
    [CommonActionType.LAUNCH_NOTEBOOK_TRUST_PROMPT]: Transfer.launchNotebookTrustPrompt,
    [CommonActionType.UNMOUNT]: Creation.unmount,
    [CommonActionType.LOAD_IPYWIDGET_CLASS_SUCCESS]: CommonEffects.handleLoadIPyWidgetClassSuccess,
    [CommonActionType.LOAD_IPYWIDGET_CLASS_FAILURE]: CommonEffects.handleLoadIPyWidgetClassFailure,
    [CommonActionType.IPYWIDGET_WIDGET_VERSION_NOT_SUPPORTED]: CommonEffects.notifyAboutUnsupportedWidgetVersions,
    [CommonActionType.CONTINUE]: Execution.continueExec,
    [CommonActionType.STEP]: Execution.step,
    [CommonActionType.RUN_BY_LINE]: Execution.runByLine,

    // Messages from the webview (some are ignored)
    [InteractiveWindowMessages.StartCell]: Creation.startCell,
    [InteractiveWindowMessages.FinishCell]: Creation.finishCell,
    [InteractiveWindowMessages.UpdateCellWithExecutionResults]: Creation.updateCell,
    [InteractiveWindowMessages.NotebookDirty]: CommonEffects.notebookDirty,
    [InteractiveWindowMessages.NotebookClean]: CommonEffects.notebookClean,
    [InteractiveWindowMessages.LoadAllCells]: Creation.loadAllCells,
    [InteractiveWindowMessages.TrustNotebookComplete]: CommonEffects.trustNotebook,
    [InteractiveWindowMessages.NotebookRunAllCells]: Execution.executeAllCells,
    [InteractiveWindowMessages.NotebookRunSelectedCell]: Execution.executeSelectedCell,
    [InteractiveWindowMessages.NotebookAddCellBelow]: Creation.addAndFocusCell,
    [InteractiveWindowMessages.DoSave]: Transfer.save,
    [InteractiveWindowMessages.DeleteAllCells]: Creation.deleteAllCells,
    [InteractiveWindowMessages.Undo]: Execution.undo,
    [InteractiveWindowMessages.Redo]: Execution.redo,
    [InteractiveWindowMessages.StartProgress]: CommonEffects.startProgress,
    [InteractiveWindowMessages.StopProgress]: CommonEffects.stopProgress,
    [SharedMessages.UpdateSettings]: Effects.updateSettings,
    [InteractiveWindowMessages.Activate]: CommonEffects.activate,
    [InteractiveWindowMessages.RestartKernel]: Kernel.handleRestarted,
    [CssMessages.GetCssResponse]: CommonEffects.handleCss,
    [InteractiveWindowMessages.MonacoReady]: CommonEffects.monacoReady,
    [CssMessages.GetMonacoThemeResponse]: CommonEffects.monacoThemeChange,
    [InteractiveWindowMessages.UpdateModel]: Creation.handleUpdate,
    [InteractiveWindowMessages.UpdateKernel]: Kernel.updateStatus,
    [SharedMessages.LocInit]: CommonEffects.handleLocInit,
    [InteractiveWindowMessages.UpdateDisplayData]: CommonEffects.handleUpdateDisplayData,
    [InteractiveWindowMessages.ShowBreak]: Execution.handleBreakState,
    [InteractiveWindowMessages.ShowContinue]: Execution.handleContinue,
    [InteractiveWindowMessages.StartDebugging]: Execution.startDebugging,
    [InteractiveWindowMessages.StopDebugging]: Execution.stopDebugging
};
