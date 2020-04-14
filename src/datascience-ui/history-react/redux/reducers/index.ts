// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages, SharedMessages } from '../../../../client/datascience/messages';
import { CommonEffects } from '../../../interactive-common/redux/reducers/commonEffects';
import { Kernel } from '../../../interactive-common/redux/reducers/kernel';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { CommonActionType } from '../../../interactive-common/redux/reducers/types';
import { IInteractiveActionMapping } from '../mapping';
import { Creation } from './creation';
import { Effects } from './effects';
import { Execution } from './execution';

// The list of reducers. 1 per message/action.
export const reducerMap: Partial<IInteractiveActionMapping> = {
    // State updates
    [CommonActionType.RESTART_KERNEL]: Kernel.restartKernel,
    [CommonActionType.INTERRUPT_KERNEL]: Kernel.interruptKernel,
    [InteractiveWindowMessages.SelectKernel]: Kernel.selectKernel,
    [CommonActionType.SELECT_SERVER]: Kernel.selectJupyterURI,
    [CommonActionType.OPEN_SETTINGS]: CommonEffects.openSettings,
    [CommonActionType.EXPORT]: Transfer.exportCells,
    [CommonActionType.SAVE]: Transfer.save,
    [CommonActionType.SHOW_DATA_VIEWER]: Transfer.showDataViewer,
    [CommonActionType.DELETE_CELL]: Creation.deleteCell,
    [InteractiveWindowMessages.ShowPlot]: Transfer.showPlot,
    [CommonActionType.LINK_CLICK]: Transfer.linkClick,
    [CommonActionType.GOTO_CELL]: Transfer.gotoCell,
    [CommonActionType.TOGGLE_INPUT_BLOCK]: Effects.toggleInputBlock,
    [CommonActionType.COPY_CELL_CODE]: Transfer.copyCellCode,
    [CommonActionType.GATHER_CELL]: Transfer.gather,
    [CommonActionType.EDIT_CELL]: Transfer.editCell,
    [CommonActionType.SUBMIT_INPUT]: Execution.submitInput,
    [InteractiveWindowMessages.ExpandAll]: Effects.expandAll,
    [CommonActionType.EDITOR_LOADED]: Transfer.started,
    [InteractiveWindowMessages.LoadAllCells]: Creation.loaded,
    [CommonActionType.SCROLL]: Effects.scrolled,
    [CommonActionType.CLICK_CELL]: Effects.clickCell,
    [CommonActionType.UNFOCUS_CELL]: Effects.unfocusCell,
    [CommonActionType.UNMOUNT]: Creation.unmount,
    [CommonActionType.FOCUS_INPUT]: CommonEffects.focusInput,
    [CommonActionType.LOAD_IPYWIDGET_CLASS_SUCCESS]: CommonEffects.handleLoadIPyWidgetClassSuccess,
    [CommonActionType.LOAD_IPYWIDGET_CLASS_FAILURE]: CommonEffects.handleLoadIPyWidgetClassFailure,
    [CommonActionType.IPYWIDGET_RENDER_FAILURE]: CommonEffects.handleIPyWidgetRenderFailure,

    // Messages from the webview (some are ignored)
    [InteractiveWindowMessages.Undo]: Execution.undo,
    [InteractiveWindowMessages.Redo]: Execution.redo,
    [InteractiveWindowMessages.StartCell]: Creation.startCell,
    [InteractiveWindowMessages.FinishCell]: Creation.finishCell,
    [InteractiveWindowMessages.UpdateCellWithExecutionResults]: Creation.updateCell,
    [InteractiveWindowMessages.Activate]: CommonEffects.activate,
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
    [SharedMessages.UpdateSettings]: Effects.updateSettings,
    [InteractiveWindowMessages.StartDebugging]: Execution.startDebugging,
    [InteractiveWindowMessages.StopDebugging]: Execution.stopDebugging,
    [InteractiveWindowMessages.ScrollToCell]: Effects.scrollToCell,
    [InteractiveWindowMessages.UpdateKernel]: Kernel.updateStatus,
    [SharedMessages.LocInit]: CommonEffects.handleLocInit,
    [InteractiveWindowMessages.UpdateDisplayData]: CommonEffects.handleUpdateDisplayData
};
