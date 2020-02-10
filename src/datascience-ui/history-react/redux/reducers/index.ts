// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IncomingMessageActions } from '../../../interactive-common/redux/postOffice';
import { CommonEffects } from '../../../interactive-common/redux/reducers/commonEffects';
import { Kernel } from '../../../interactive-common/redux/reducers/kernel';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { CommonActionType } from '../../../interactive-common/redux/reducers/types';
import { IInteractiveActionMapping } from '../mapping';
import { Creation } from './creation';
import { Effects } from './effects';
import { Execution } from './execution';

// The list of reducers. 1 per message/action.
export const reducerMap: IInteractiveActionMapping = {
    // State updates
    [CommonActionType.RESTART_KERNEL]: Kernel.restartKernel,
    [CommonActionType.INTERRUPT_KERNEL]: Kernel.interruptKernel,
    [CommonActionType.SELECT_KERNEL]: Kernel.selectKernel,
    [CommonActionType.SELECT_SERVER]: Kernel.selectJupyterURI,
    [CommonActionType.EXPORT]: Transfer.exportCells,
    [CommonActionType.SAVE]: Transfer.save,
    [CommonActionType.SHOW_DATA_VIEWER]: Transfer.showDataViewer,
    [CommonActionType.DELETE_CELL]: Creation.deleteCell,
    [CommonActionType.UNDO]: Execution.undo,
    [CommonActionType.REDO]: Execution.redo,
    [CommonActionType.SHOW_PLOT]: Transfer.showPlot,
    [CommonActionType.LINK_CLICK]: Transfer.linkClick,
    [CommonActionType.GOTO_CELL]: Transfer.gotoCell,
    [CommonActionType.TOGGLE_INPUT_BLOCK]: Effects.toggleInputBlock,
    [CommonActionType.COPY_CELL_CODE]: Transfer.copyCellCode,
    [CommonActionType.GATHER_CELL]: Transfer.gather,
    [CommonActionType.EDIT_CELL]: Transfer.editCell,
    [CommonActionType.SUBMIT_INPUT]: Execution.submitInput,
    [CommonActionType.DELETE_ALL_CELLS]: Creation.deleteAllCells,
    [CommonActionType.EXPAND_ALL]: Effects.expandAll,
    [CommonActionType.COLLAPSE_ALL]: Effects.collapseAll,
    [CommonActionType.EDITOR_LOADED]: Transfer.started,
    [CommonActionType.SCROLL]: Effects.scrolled,
    [CommonActionType.CLICK_CELL]: Effects.clickCell,
    [CommonActionType.UNFOCUS_CELL]: Effects.unfocusCell,
    [CommonActionType.UNMOUNT]: Creation.unmount,
    [CommonActionType.FOCUS_INPUT]: CommonEffects.focusInput,

    // Messages from the webview (some are ignored)
    [IncomingMessageActions.STARTCELL]: Creation.startCell,
    [IncomingMessageActions.FINISHCELL]: Creation.finishCell,
    [IncomingMessageActions.UPDATECELL]: Creation.updateCell,
    [IncomingMessageActions.ACTIVATE]: CommonEffects.activate,
    [IncomingMessageActions.RESTARTKERNEL]: Kernel.handleRestarted,
    [IncomingMessageActions.GETCSSRESPONSE]: CommonEffects.handleCss,
    [IncomingMessageActions.MONACOREADY]: CommonEffects.monacoReady,
    [IncomingMessageActions.GETMONACOTHEMERESPONSE]: CommonEffects.monacoThemeChange,
    [IncomingMessageActions.GETALLCELLS]: Transfer.getAllCells,
    [IncomingMessageActions.EXPANDALL]: Effects.expandAll,
    [IncomingMessageActions.COLLAPSEALL]: Effects.collapseAll,
    [IncomingMessageActions.DELETEALLCELLS]: Creation.deleteAllCells,
    [IncomingMessageActions.STARTPROGRESS]: CommonEffects.startProgress,
    [IncomingMessageActions.STOPPROGRESS]: CommonEffects.stopProgress,
    [IncomingMessageActions.UPDATESETTINGS]: Effects.updateSettings,
    [IncomingMessageActions.STARTDEBUGGING]: Execution.startDebugging,
    [IncomingMessageActions.STOPDEBUGGING]: Execution.stopDebugging,
    [IncomingMessageActions.SCROLLTOCELL]: Effects.scrollToCell,
    [IncomingMessageActions.UPDATEKERNEL]: Kernel.updateStatus,
    [IncomingMessageActions.LOCINIT]: CommonEffects.handleLocInit
};
