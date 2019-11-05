// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveActionTypes } from '../actions';
import { IInteractiveActionMapping } from '../mapping';
import { CssMessages } from '../../../../client/datascience/messages';
import { Variables } from '../../../interactive-common/redux/reducers/variables';
import { Creation } from './creation';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { Kernel } from '../../../interactive-common/redux/reducers/kernel';
import { Execution } from './execution';
import { CommonEffects } from '../../../interactive-common/redux/reducers/commonEffects';
import { Effects } from './effects';
import { IncomingMessageActions } from '../../../interactive-common/redux/postOffice';



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

}
