import { CommonActionType, CommonActionTypeMapping } from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { CssMessages, SharedMessages } from '../messages';
import { IInteractiveWindowMapping, InteractiveWindowMessages } from './interactiveWindowTypes';

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum MessageType {
    /**
     * Action dispatched as result of some user action.
     */
    userAction = 0,
    /**
     * Action dispatched to re-broadcast a message across other editors of the same file in the same session.
     */
    syncAcrossSameNotebooks = 1 << 0,
    /**
     * Action dispatched to re-broadcast a message across other sessions (live share).
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
    [CommonActionType.ADD_AND_FOCUS_NEW_CELL]: MessageType.userAction,
    [CommonActionType.ADD_NEW_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.ARROW_DOWN]: MessageType.syncWithLiveShare,
    [CommonActionType.ARROW_UP]: MessageType.syncWithLiveShare,
    [CommonActionType.CHANGE_CELL_TYPE]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.CLICK_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.DELETE_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.CODE_CREATED]: MessageType.noIdea,
    [CommonActionType.COPY_CELL_CODE]: MessageType.userAction,
    [CommonActionType.EDITOR_LOADED]: MessageType.userAction,
    [CommonActionType.EDIT_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.EXECUTE_CELL_AND_ADVANCE]: MessageType.userAction,
    [CommonActionType.EXECUTE_ABOVE]: MessageType.userAction,
    [CommonActionType.EXECUTE_ALL_CELLS]: MessageType.userAction,
    [CommonActionType.EXECUTE_CELL]: MessageType.userAction,
    [CommonActionType.EXECUTE_CELL_AND_BELOW]: MessageType.userAction,
    [CommonActionType.EXPORT]: MessageType.userAction,
    [CommonActionType.FOCUS_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.GATHER_CELL]: MessageType.userAction,
    [CommonActionType.GET_VARIABLE_DATA]: MessageType.userAction,
    [CommonActionType.GOTO_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_ABOVE_AND_FOCUS_NEW_CELL]: MessageType.userAction,
    [CommonActionType.INSERT_ABOVE]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_ABOVE_FIRST_AND_FOCUS_NEW_CELL]: MessageType.userAction,
    [CommonActionType.INSERT_ABOVE_FIRST]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_BELOW]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_BELOW_AND_FOCUS_NEW_CELL]: MessageType.userAction,
    [CommonActionType.INTERRUPT_KERNEL]: MessageType.userAction,
    [CommonActionType.LOADED_ALL_CELLS]: MessageType.userAction,
    [CommonActionType.LINK_CLICK]: MessageType.userAction,
    [CommonActionType.MOVE_CELL_DOWN]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.MOVE_CELL_UP]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.RESTART_KERNEL]: MessageType.userAction,
    [CommonActionType.SAVE]: MessageType.userAction,
    [CommonActionType.SCROLL]: MessageType.syncWithLiveShare,
    [CommonActionType.SELECT_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.SELECT_SERVER]: MessageType.userAction,
    [CommonActionType.SEND_COMMAND]: MessageType.userAction,
    [CommonActionType.SHOW_DATA_VIEWER]: MessageType.userAction,
    [CommonActionType.SUBMIT_INPUT]: MessageType.userAction,
    [CommonActionType.TOGGLE_INPUT_BLOCK]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_LINE_NUMBERS]: MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_OUTPUT]: MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: MessageType.syncWithLiveShare,
    [CommonActionType.UNFOCUS_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.UNMOUNT]: MessageType.userAction,
    [CommonActionType.PostOutgoingMessage]: MessageType.userAction,
    [CommonActionType.REFRESH_VARIABLES]: MessageType.userAction,

    // Types from InteractiveWindowMessages
    [InteractiveWindowMessages.Activate]: MessageType.userAction,
    [InteractiveWindowMessages.AddedSysInfo]: MessageType.userAction,
    [InteractiveWindowMessages.CancelCompletionItemsRequest]: MessageType.userAction,
    [InteractiveWindowMessages.CancelHoverRequest]: MessageType.userAction,
    [InteractiveWindowMessages.CancelResolveCompletionItemRequest]: MessageType.userAction,
    [InteractiveWindowMessages.CancelSignatureHelpRequest]: MessageType.userAction,
    [InteractiveWindowMessages.ClearAllOutputs]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.CollapseAll]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.CopyCodeCell]: MessageType.userAction,
    [InteractiveWindowMessages.DeleteAllCells]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.DoSave]: MessageType.userAction,
    [InteractiveWindowMessages.ExecutionRendered]: MessageType.userAction,
    [InteractiveWindowMessages.ExpandAll]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Export]: MessageType.userAction,
    [InteractiveWindowMessages.FinishCell]: MessageType.userAction,
    [InteractiveWindowMessages.FocusedCellEditor]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.GatherCodeRequest]: MessageType.userAction,
    [InteractiveWindowMessages.GetAllCells]: MessageType.userAction,
    [InteractiveWindowMessages.GetVariablesRequest]: MessageType.userAction,
    [InteractiveWindowMessages.GetVariablesResponse]: MessageType.userAction,
    [InteractiveWindowMessages.GotoCodeCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.GotoCodeCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Interrupt]: MessageType.userAction,
    [InteractiveWindowMessages.LoadAllCells]: MessageType.userAction,
    [InteractiveWindowMessages.LoadAllCellsComplete]: MessageType.userAction,
    [InteractiveWindowMessages.LoadOnigasmAssemblyRequest]: MessageType.userAction,
    [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MessageType.userAction,
    [InteractiveWindowMessages.LoadTmLanguageRequest]: MessageType.userAction,
    [InteractiveWindowMessages.LoadTmLanguageResponse]: MessageType.userAction,
    [InteractiveWindowMessages.MonacoReady]: MessageType.userAction,
    [InteractiveWindowMessages.NativeCommand]: MessageType.userAction,
    [InteractiveWindowMessages.NotebookAddCellBelow]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.NotebookClean]: MessageType.userAction,
    [InteractiveWindowMessages.NotebookDirty]: MessageType.userAction,
    [InteractiveWindowMessages.NotebookExecutionActivated]: MessageType.userAction,
    [InteractiveWindowMessages.NotebookIdentity]: MessageType.userAction,
    [InteractiveWindowMessages.NotebookRunAllCells]: MessageType.userAction,
    [InteractiveWindowMessages.NotebookRunSelectedCell]: MessageType.userAction,
    [InteractiveWindowMessages.OpenLink]: MessageType.userAction,
    [InteractiveWindowMessages.ProvideCompletionItemsRequest]: MessageType.userAction,
    [InteractiveWindowMessages.ProvideCompletionItemsResponse]: MessageType.userAction,
    [InteractiveWindowMessages.ProvideHoverRequest]: MessageType.userAction,
    [InteractiveWindowMessages.ProvideHoverResponse]: MessageType.userAction,
    [InteractiveWindowMessages.ProvideSignatureHelpRequest]: MessageType.userAction,
    [InteractiveWindowMessages.ProvideSignatureHelpResponse]: MessageType.userAction,
    [InteractiveWindowMessages.ReExecuteCell]: MessageType.userAction,
    [InteractiveWindowMessages.Redo]: MessageType.userAction,
    [InteractiveWindowMessages.RemoteAddCode]: MessageType.userAction,
    [InteractiveWindowMessages.ReceivedUpdateModel]: MessageType.userAction,
    [InteractiveWindowMessages.RemoteReexecuteCode]: MessageType.userAction,
    [InteractiveWindowMessages.ResolveCompletionItemRequest]: MessageType.userAction,
    [InteractiveWindowMessages.ResolveCompletionItemResponse]: MessageType.userAction,
    [InteractiveWindowMessages.RestartKernel]: MessageType.userAction,
    [InteractiveWindowMessages.ReturnAllCells]: MessageType.userAction,
    [InteractiveWindowMessages.SaveAll]: MessageType.userAction,
    [InteractiveWindowMessages.SavePng]: MessageType.userAction,
    [InteractiveWindowMessages.ScrollToCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.SelectJupyterServer]: MessageType.userAction,
    [InteractiveWindowMessages.SelectKernel]: MessageType.userAction,
    [InteractiveWindowMessages.SendInfo]: MessageType.userAction,
    [InteractiveWindowMessages.SettingsUpdated]: MessageType.userAction,
    [InteractiveWindowMessages.ShowDataViewer]: MessageType.userAction,
    [InteractiveWindowMessages.ShowPlot]: MessageType.userAction,
    [InteractiveWindowMessages.StartCell]: MessageType.userAction,
    [InteractiveWindowMessages.StartDebugging]: MessageType.userAction,
    [InteractiveWindowMessages.StartProgress]: MessageType.userAction,
    [InteractiveWindowMessages.Started]: MessageType.userAction,
    [InteractiveWindowMessages.StopDebugging]: MessageType.userAction,
    [InteractiveWindowMessages.StopProgress]: MessageType.userAction,
    [InteractiveWindowMessages.SubmitNewCell]: MessageType.userAction,
    [InteractiveWindowMessages.Sync]: MessageType.userAction,
    [InteractiveWindowMessages.Undo]: MessageType.userAction,
    [InteractiveWindowMessages.UnfocusedCellEditor]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateCell]: MessageType.userAction,
    [InteractiveWindowMessages.UpdateModel]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateKernel]: MessageType.userAction,
    [InteractiveWindowMessages.VariableExplorerToggle]: MessageType.userAction,
    [InteractiveWindowMessages.VariablesComplete]: MessageType.userAction,
    // Types from CssMessages
    [CssMessages.GetCssRequest]: MessageType.userAction,
    [CssMessages.GetCssResponse]: MessageType.userAction,
    [CssMessages.GetMonacoThemeRequest]: MessageType.userAction,
    [CssMessages.GetMonacoThemeResponse]: MessageType.userAction,
    // Types from Shared Messages
    [SharedMessages.LocInit]: MessageType.userAction,
    [SharedMessages.Started]: MessageType.userAction,
    [SharedMessages.UpdateSettings]: MessageType.userAction
};

/**
 * If the original message was a sync message, then do not send messages to extension.
 *  We allow messages to be sent to extension ONLY when the original message was triggered by the user.
 *
 * @export
 * @param {MessageType} [messageType]
 * @returns
 */
export function checkToPostBasedOnOriginalMessageType(messageType?: MessageType): boolean {
    if (!messageType) {
        return true;
    }
    if (
        (messageType & MessageType.syncAcrossSameNotebooks) === MessageType.syncAcrossSameNotebooks ||
        (messageType & MessageType.syncWithLiveShare) === MessageType.syncWithLiveShare
    ) {
        return false;
    }

    return true;
}

export function shouldRebroadcast(message: keyof IInteractiveWindowMapping): [boolean, MessageType] {
    // Get the configured type for this message (whether it should be re-broadcasted or not).
    const messageType: MessageType | undefined = messageWithMessageTypes[message];
    // Support for liveshare is turned off for now, we can enable that later.
    // I.e. we only support synchronizing across editors in the same session.
    if (messageType === undefined || (messageType & MessageType.syncAcrossSameNotebooks) !== MessageType.syncAcrossSameNotebooks) {
        return [false, MessageType.userAction];
    }

    return [(messageType & MessageType.syncAcrossSameNotebooks) > 0 || (messageType & MessageType.syncWithLiveShare) > 0, messageType];
}
