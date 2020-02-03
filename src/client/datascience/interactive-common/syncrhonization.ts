import { CommonActionType, CommonActionTypeMapping } from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { CssMessages, SharedMessages } from '../messages';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from './interactiveWindowTypes';

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum MessageType {
    other = 0,
    /**
     * Messages must be re-broadcasted across other editors of the same file in the same session.
     */
    syncAcrossSameNotebooks = 1 << 0,
    /**
     * Messages must be re-broadcasted across all sessions.
     */
    syncWithLiveShare = 1 << 1,
    noIdea = 1 << 2
}

type MessageMapping<T> = {
    [P in keyof T]: MessageType;
};

export type IInteractiveActionMapping = MessageMapping<IInteractiveWindowMapping>;

// Do not change to a dictionary or a record.
// The current structure ensures all new enums added will be categorized.
// This way, if a new message is added, we'll make the decision early on whether it needs to be synchronized and how.
// Rather than waiting for users to report issues related to new messages.
const messageWithMessageTypes: MessageMapping<IInteractiveWindowMapping> & MessageMapping<CommonActionTypeMapping> = {
    [CommonActionType.ADD_NEW_CELL]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.ARROW_DOWN]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.ARROW_UP]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.CHANGE_CELL_TYPE]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.CLICK_CELL]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.CODE_CREATED]: MessageType.noIdea,
    [CommonActionType.COPY_CELL_CODE]: MessageType.other,
    [CommonActionType.EDITOR_LOADED]: MessageType.other,
    [CommonActionType.EDIT_CELL]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.EXECUTE_ABOVE]: MessageType.other,
    [CommonActionType.EXECUTE_ALL_CELLS]: MessageType.other,
    [CommonActionType.EXECUTE_CELL]: MessageType.other,
    [CommonActionType.EXECUTE_CELL_AND_BELOW]: MessageType.other,
    [CommonActionType.EXPORT]: MessageType.other,
    [CommonActionType.FOCUS_CELL]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.GATHER_CELL]: MessageType.other,
    [CommonActionType.GET_VARIABLE_DATA]: MessageType.other,
    [CommonActionType.GOTO_CELL]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.INSERT_ABOVE]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.INSERT_ABOVE_FIRST]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.INSERT_BELOW]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.INTERRUPT_KERNEL]: MessageType.other,
    [CommonActionType.LOADED_ALL_CELLS]: MessageType.other,
    [CommonActionType.LINK_CLICK]: MessageType.other,
    [CommonActionType.MOVE_CELL_DOWN]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.MOVE_CELL_UP]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.RESTART_KERNEL]: MessageType.other,
    [CommonActionType.SAVE]: MessageType.other,
    [CommonActionType.SCROLL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.SELECT_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.SELECT_SERVER]: MessageType.other,
    [CommonActionType.SEND_COMMAND]: MessageType.other,
    [CommonActionType.SHOW_DATA_VIEWER]: MessageType.other,
    [CommonActionType.SUBMIT_INPUT]: MessageType.other,
    [CommonActionType.TOGGLE_INPUT_BLOCK]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.TOGGLE_LINE_NUMBERS]: MessageType.syncAcrossSameNotebooks,
    [CommonActionType.TOGGLE_OUTPUT]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.UNFOCUS_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.UNMOUNT]: MessageType.other,

    // Types from InteractiveWindowMessages
    [InteractiveWindowMessages.Activate]: MessageType.other,
    [InteractiveWindowMessages.AddCell]: MessageType.syncAcrossSameNotebooks,
    [InteractiveWindowMessages.AddedSysInfo]: MessageType.other,
    [InteractiveWindowMessages.CancelCompletionItemsRequest]: MessageType.other,
    [InteractiveWindowMessages.CancelHoverRequest]: MessageType.other,
    [InteractiveWindowMessages.CancelResolveCompletionItemRequest]: MessageType.other,
    [InteractiveWindowMessages.CancelSignatureHelpRequest]: MessageType.other,
    [InteractiveWindowMessages.ClearAllOutputs]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.CollapseAll]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.CopyCodeCell]: MessageType.other,
    [InteractiveWindowMessages.DeleteAllCells]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.DeleteCell]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.DoSave]: MessageType.other,
    [InteractiveWindowMessages.EditCell]: MessageType.other,
    [InteractiveWindowMessages.ExecutionRendered]: MessageType.other,
    [InteractiveWindowMessages.ExpandAll]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Export]: MessageType.other,
    [InteractiveWindowMessages.FinishCell]: MessageType.other,
    [InteractiveWindowMessages.FocusedCellEditor]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.GatherCodeRequest]: MessageType.other,
    [InteractiveWindowMessages.GetAllCells]: MessageType.other,
    [InteractiveWindowMessages.GetVariablesRequest]: MessageType.other,
    [InteractiveWindowMessages.GetVariablesResponse]: MessageType.other,
    [InteractiveWindowMessages.GotoCodeCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.GotoCodeCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.InsertCell]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Interrupt]: MessageType.other,
    [InteractiveWindowMessages.LoadAllCells]: MessageType.other,
    [InteractiveWindowMessages.LoadAllCellsComplete]: MessageType.other,
    [InteractiveWindowMessages.LoadOnigasmAssemblyRequest]: MessageType.other,
    [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MessageType.other,
    [InteractiveWindowMessages.LoadTmLanguageRequest]: MessageType.other,
    [InteractiveWindowMessages.LoadTmLanguageResponse]: MessageType.other,
    [InteractiveWindowMessages.MonacoReady]: MessageType.other,
    [InteractiveWindowMessages.NativeCommand]: MessageType.other,
    [InteractiveWindowMessages.NotebookAddCellBelow]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.NotebookClean]: MessageType.other,
    [InteractiveWindowMessages.NotebookDirty]: MessageType.other,
    [InteractiveWindowMessages.NotebookExecutionActivated]: MessageType.other,
    [InteractiveWindowMessages.NotebookIdentity]: MessageType.other,
    [InteractiveWindowMessages.NotebookRunAllCells]: MessageType.other,
    [InteractiveWindowMessages.NotebookRunSelectedCell]: MessageType.other,
    [InteractiveWindowMessages.OpenLink]: MessageType.other,
    [InteractiveWindowMessages.ProvideCompletionItemsRequest]: MessageType.other,
    [InteractiveWindowMessages.ProvideCompletionItemsResponse]: MessageType.other,
    [InteractiveWindowMessages.ProvideHoverRequest]: MessageType.other,
    [InteractiveWindowMessages.ProvideHoverResponse]: MessageType.other,
    [InteractiveWindowMessages.ProvideSignatureHelpRequest]: MessageType.other,
    [InteractiveWindowMessages.ProvideSignatureHelpResponse]: MessageType.other,
    [InteractiveWindowMessages.ReExecuteCell]: MessageType.other,
    [InteractiveWindowMessages.Redo]: MessageType.other,
    [InteractiveWindowMessages.RemoteAddCode]: MessageType.other,
    [InteractiveWindowMessages.RemoteReexecuteCode]: MessageType.other,
    [InteractiveWindowMessages.RemoveCell]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.ResolveCompletionItemRequest]: MessageType.other,
    [InteractiveWindowMessages.ResolveCompletionItemResponse]: MessageType.other,
    [InteractiveWindowMessages.RestartKernel]: MessageType.other,
    [InteractiveWindowMessages.ReturnAllCells]: MessageType.other,
    [InteractiveWindowMessages.SaveAll]: MessageType.other,
    [InteractiveWindowMessages.SavePng]: MessageType.other,
    [InteractiveWindowMessages.ScrollToCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.SelectJupyterServer]: MessageType.other,
    [InteractiveWindowMessages.SelectKernel]: MessageType.other,
    [InteractiveWindowMessages.SendInfo]: MessageType.other,
    [InteractiveWindowMessages.SettingsUpdated]: MessageType.other,
    [InteractiveWindowMessages.ShowDataViewer]: MessageType.other,
    [InteractiveWindowMessages.ShowPlot]: MessageType.other,
    [InteractiveWindowMessages.StartCell]: MessageType.other,
    [InteractiveWindowMessages.StartDebugging]: MessageType.other,
    [InteractiveWindowMessages.StartProgress]: MessageType.other,
    [InteractiveWindowMessages.Started]: MessageType.other,
    [InteractiveWindowMessages.StopDebugging]: MessageType.other,
    [InteractiveWindowMessages.StopProgress]: MessageType.other,
    [InteractiveWindowMessages.SubmitNewCell]: MessageType.other,
    [InteractiveWindowMessages.SwapCells]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Sync]: MessageType.other,
    [InteractiveWindowMessages.Undo]: MessageType.other,
    [InteractiveWindowMessages.UnfocusedCellEditor]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateCell]: MessageType.other,
    [InteractiveWindowMessages.UpdateKernel]: MessageType.other,
    [InteractiveWindowMessages.VariableExplorerToggle]: MessageType.other,
    [InteractiveWindowMessages.VariablesComplete]: MessageType.other,
    // Types from CssMessages
    [CssMessages.GetCssRequest]: MessageType.other,
    [CssMessages.GetCssResponse]: MessageType.other,
    [CssMessages.GetMonacoThemeRequest]: MessageType.other,
    [CssMessages.GetMonacoThemeResponse]: MessageType.other,
    // Types from Shared Messages
    [SharedMessages.LocInit]: MessageType.other,
    [SharedMessages.Started]: MessageType.other,
    [SharedMessages.UpdateSettings]: MessageType.other
};

export function shouldRebroadcast(message: keyof IInteractiveWindowMapping): [boolean, MessageType] {
    if (!messageWithMessageTypes[message]) {
        return [false, MessageType.other];
    }
    const messageType: MessageType = messageWithMessageTypes[message];
    return [(messageType & MessageType.syncAcrossSameNotebooks) > 0 || (messageType & MessageType.syncWithLiveShare) > 0, messageType];
}
