// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
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

    // Messages from the webview (some are ignored)
    [InteractiveWindowMessages.StartCell]: Creation.startCell,
    [InteractiveWindowMessages.FinishCell]: Creation.finishCell,
    [InteractiveWindowMessages.UpdateCell]: Creation.updateCell,
    [InteractiveWindowMessages.Activate]: CommonEffects.activate,
    [InteractiveWindowMessages.GetVariablesResponse]: Variables.handleVariablesResponse,
    [InteractiveWindowMessages.GetVariableValueResponse]: Variables.handleVariableResponse,
    [InteractiveWindowMessages.RestartKernel]: Kernel.handleRestarted,
    [CssMessages.GetCssResponse]: CommonEffects.handleCss,
    [InteractiveWindowMessages.MonacoReady]: CommonEffects.monacoReady,
    [CssMessages.GetMonacoThemeResponse]: CommonEffects.monacoThemeChange,
    [InteractiveWindowMessages.GetAllCells]: Transfer.getAllCells,
    [InteractiveWindowMessages.ExpandAll]: Effects.expandAll,
    [InteractiveWindowMessages.CollapseAll]: Effects.collapseAll,
    [InteractiveWindowMessages.DeleteAllCells]: Creation.deleteAllCells,
    [InteractiveWindowMessages.StartProgress]: CommonEffects.startProgress,
    [InteractiveWindowMessages.StopProgress]: CommonEffects.stopProgress,
    [InteractiveWindowMessages.UpdateSettings]: Effects.updateSettings,
    [InteractiveWindowMessages.StartDebugging]: Execution.startDebugging,
    [InteractiveWindowMessages.StopDebugging]: Execution.stopDebugging,
    [InteractiveWindowMessages.ScrollToCell]: Effects.scrollToCell,

}
