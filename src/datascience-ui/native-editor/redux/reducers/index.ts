// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IncomingMessageActions } from '../../../interactive-common/redux/postOffice';
import { CommonEffects } from '../../../interactive-common/redux/reducers/commonEffects';
import { Kernel } from '../../../interactive-common/redux/reducers/kernel';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { Variables } from '../../../interactive-common/redux/reducers/variables';
import { NativeEditorActionTypes } from '../actions';
import { INativeEditorActionMapping } from '../mapping';
import { Creation } from './creation';
import { Effects } from './effects';
import { Execution } from './execution';
import { Movement } from './movement';

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
    [NativeEditorActionTypes.EDIT_CELL]: Transfer.editCell,
    [NativeEditorActionTypes.SHOW_PLOT]: Transfer.showPlot,
    [NativeEditorActionTypes.OPEN_LINK]: Transfer.openLink,
    [NativeEditorActionTypes.GATHER_CELL]: Transfer.gather,

    // Messages from the webview (some are ignored)
    [IncomingMessageActions.STARTCELL]: Creation.startCell,
    [IncomingMessageActions.FINISHCELL]: Creation.finishCell,
    [IncomingMessageActions.UPDATECELL]: Creation.updateCell,
    [IncomingMessageActions.NOTEBOOKDIRTY]: CommonEffects.notebookDirty,
    [IncomingMessageActions.NOTEBOOKCLEAN]: CommonEffects.notebookClean,
    [IncomingMessageActions.LOADALLCELLS]: Creation.loadAllCells,
    [IncomingMessageActions.NOTEBOOKRUNALLCELLS]: Execution.executeAllCells,
    [IncomingMessageActions.NOTEBOOKRUNSELECTEDCELL]: Execution.executeSelectedCell,
    [IncomingMessageActions.NOTEBOOKADDCELLBELOW]: Creation.addNewCell,
    [IncomingMessageActions.DOSAVE]: Transfer.save,
    [IncomingMessageActions.DELETEALLCELLS]: Creation.deleteAllCells,
    [IncomingMessageActions.UNDO]: Execution.undo,
    [IncomingMessageActions.REDO]: Execution.redo,
    [IncomingMessageActions.STARTPROGRESS]: CommonEffects.startProgress,
    [IncomingMessageActions.STOPPROGRESS]: CommonEffects.stopProgress,
    [IncomingMessageActions.UPDATESETTINGS]: Effects.updateSettings,
    [IncomingMessageActions.ACTIVATE]: CommonEffects.activate,
    [IncomingMessageActions.GETVARIABLESRESPONSE]: Variables.handleVariablesResponse,
    [IncomingMessageActions.GETVARIABLEVALUERESPONSE]: Variables.handleVariableResponse,
    [IncomingMessageActions.RESTARTKERNEL]: Kernel.handleRestarted,
    [IncomingMessageActions.GETCSSRESPONSE]: CommonEffects.handleCss,
    [IncomingMessageActions.MONACOREADY]: CommonEffects.monacoReady,
    [IncomingMessageActions.GETMONACOTHEMERESPONSE]: CommonEffects.monacoThemeChange
};
