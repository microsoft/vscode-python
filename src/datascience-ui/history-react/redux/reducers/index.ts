// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IncomingMessageActions } from '../../../interactive-common/redux/postOffice';
import { CommonEffects } from '../../../interactive-common/redux/reducers/commonEffects';
import { Kernel } from '../../../interactive-common/redux/reducers/kernel';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { Variables } from '../../../interactive-common/redux/reducers/variables';
import { InteractiveActionTypes } from '../actions';
import { IInteractiveActionMapping } from '../mapping';
import { Creation } from './creation';
import { Effects } from './effects';
import { Execution } from './execution';

// The list of reducers. 1 per message/action.
export const reducerMap: IInteractiveActionMapping = {
    // State updates
    [InteractiveActionTypes.TOGGLE_VARIABLE_EXPLORER]: Variables.toggleVariableExplorer,
    [InteractiveActionTypes.REFRESH_VARIABLES]: Variables.refreshVariables,
    [InteractiveActionTypes.RESTART_KERNEL]: Kernel.restartKernel,
    [InteractiveActionTypes.INTERRUPT_KERNEL]: Kernel.interruptKernel,
    [InteractiveActionTypes.EXPORT]: Transfer.exportCells,
    [InteractiveActionTypes.SAVE]: Transfer.save,
    [InteractiveActionTypes.SHOW_DATA_VIEWER]: Transfer.showDataViewer,
    [InteractiveActionTypes.DELETE_CELL]: Creation.deleteCell,
    [InteractiveActionTypes.UNDO]: Execution.undo,
    [InteractiveActionTypes.REDO]: Execution.redo,
    [InteractiveActionTypes.SHOW_PLOT]: Transfer.showPlot,
    [InteractiveActionTypes.OPEN_LINK]: Transfer.openLink,
    [InteractiveActionTypes.GOTO_CELL]: Transfer.gotoCell,
    [InteractiveActionTypes.TOGGLE_INPUT_BLOCK]: Effects.toggleInputBlock,
    [InteractiveActionTypes.COPY_CELL_CODE]: Transfer.copyCellCode,
    [InteractiveActionTypes.GATHER_CELL]: Transfer.gather,
    [InteractiveActionTypes.EDIT_CELL]: Transfer.editCell,
    [InteractiveActionTypes.SUBMIT_INPUT]: Execution.submitInput,
    [InteractiveActionTypes.DELETE_ALL_CELLS]: Creation.deleteAllCells,
    [InteractiveActionTypes.EXPAND_ALL]: Effects.expandAll,
    [InteractiveActionTypes.COLLAPSE_ALL]: Effects.collapseAll,
    [InteractiveActionTypes.EDITOR_LOADED]: Transfer.started,
    [InteractiveActionTypes.SCROLL]: Effects.scrolled,
    [InteractiveActionTypes.CLICK_CELL]: Effects.clickCell,
    [InteractiveActionTypes.UNFOCUS_CELL]: Effects.unfocusCell,

    // Messages from the webview (some are ignored)
    [IncomingMessageActions.STARTCELL]: Creation.startCell,
    [IncomingMessageActions.FINISHCELL]: Creation.finishCell,
    [IncomingMessageActions.UPDATECELL]: Creation.updateCell,
    [IncomingMessageActions.ACTIVATE]: CommonEffects.activate,
    [IncomingMessageActions.GETVARIABLESRESPONSE]: Variables.handleVariablesResponse,
    [IncomingMessageActions.GETVARIABLEVALUERESPONSE]: Variables.handleVariableResponse,
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
    [IncomingMessageActions.SCROLLTOCELL]: Effects.scrollToCell
};
