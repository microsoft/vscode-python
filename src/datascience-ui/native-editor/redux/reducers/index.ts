// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IncomingMessageActions } from '../../../interactive-common/redux/postOffice';
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
export const reducerMap: INativeEditorActionMapping = {
    // State updates
    [CommonActionType.INSERT_ABOVE]: Creation.insertAbove,
    [CommonActionType.INSERT_ABOVE_FIRST]: Creation.insertAboveFirst,
    [CommonActionType.INSERT_BELOW]: Creation.insertBelow,
    [CommonActionType.FOCUS_CELL]: Effects.focusCell,
    [CommonActionType.UNFOCUS_CELL]: Effects.unfocusCell,
    [CommonActionType.ADD_NEW_CELL]: Creation.addNewCell,
    [CommonActionType.EXECUTE_CELL]: Execution.executeCell,
    [CommonActionType.EXECUTE_ALL_CELLS]: Execution.executeAllCells,
    [CommonActionType.EXECUTE_ABOVE]: Execution.executeAbove,
    [CommonActionType.EXECUTE_CELL_AND_BELOW]: Execution.executeCellAndBelow,
    [CommonActionType.RESTART_KERNEL]: Kernel.restartKernel,
    [CommonActionType.INTERRUPT_KERNEL]: Kernel.interruptKernel,
    [CommonActionType.CLEAR_ALL_OUTPUTS]: Execution.clearAllOutputs,
    [CommonActionType.EXPORT]: Transfer.exportCells,
    [CommonActionType.SAVE]: Transfer.save,
    [CommonActionType.SHOW_DATA_VIEWER]: Transfer.showDataViewer,
    [CommonActionType.SEND_COMMAND]: Transfer.sendCommand,
    [CommonActionType.SELECT_CELL]: Effects.selectCell,
    [CommonActionType.SELECT_KERNEL]: Kernel.selectKernel,
    [CommonActionType.SELECT_SERVER]: Kernel.selectJupyterURI,
    [CommonActionType.MOVE_CELL_UP]: Movement.moveCellUp,
    [CommonActionType.MOVE_CELL_DOWN]: Movement.moveCellDown,
    [CommonActionType.DELETE_CELL]: Creation.deleteCell,
    [CommonActionType.TOGGLE_LINE_NUMBERS]: Effects.toggleLineNumbers,
    [CommonActionType.TOGGLE_OUTPUT]: Effects.toggleOutput,
    [CommonActionType.CHANGE_CELL_TYPE]: Execution.changeCellType,
    [CommonActionType.UNDO]: Execution.undo,
    [CommonActionType.REDO]: Execution.redo,
    [CommonActionType.ARROW_UP]: Movement.arrowUp,
    [CommonActionType.ARROW_DOWN]: Movement.arrowDown,
    [CommonActionType.EDIT_CELL]: Transfer.editCell,
    [CommonActionType.SHOW_PLOT]: Transfer.showPlot,
    [CommonActionType.LINK_CLICK]: Transfer.linkClick,
    [CommonActionType.GATHER_CELL]: Transfer.gather,
    [CommonActionType.EDITOR_LOADED]: Transfer.started,
    [CommonActionType.LOADED_ALL_CELLS]: Transfer.loadedAllCells,
    [CommonActionType.UNMOUNT]: Creation.unmount,

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
    [IncomingMessageActions.RESTARTKERNEL]: Kernel.handleRestarted,
    [IncomingMessageActions.GETCSSRESPONSE]: CommonEffects.handleCss,
    [IncomingMessageActions.MONACOREADY]: CommonEffects.monacoReady,
    [IncomingMessageActions.GETMONACOTHEMERESPONSE]: CommonEffects.monacoThemeChange,
    [IncomingMessageActions.UPDATEKERNEL]: Kernel.updateStatus,
    [IncomingMessageActions.LOCINIT]: CommonEffects.handleLocInit
};
