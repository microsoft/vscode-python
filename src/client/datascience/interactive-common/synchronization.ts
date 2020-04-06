import {
    CommonActionType,
    CommonActionTypeMapping
} from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { CssMessages, SharedMessages } from '../messages';
import { IInteractiveWindowMapping, InteractiveWindowMessages, IPyWidgetMessages } from './interactiveWindowTypes';

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum MessageType {
    /**
     * Action dispatched as result of some user action.
     */
    other = 0,
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
    [CommonActionType.ADD_AND_FOCUS_NEW_CELL]: MessageType.other,
    [CommonActionType.ADD_NEW_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.ARROW_DOWN]: MessageType.syncWithLiveShare,
    [CommonActionType.ARROW_UP]: MessageType.syncWithLiveShare,
    [CommonActionType.CHANGE_CELL_TYPE]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.CLICK_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.DELETE_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.CODE_CREATED]: MessageType.noIdea,
    [CommonActionType.COPY_CELL_CODE]: MessageType.other,
    [CommonActionType.EDITOR_LOADED]: MessageType.other,
    [CommonActionType.EDIT_CELL]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.EXECUTE_CELL_AND_ADVANCE]: MessageType.other,
    [CommonActionType.EXECUTE_ABOVE]: MessageType.other,
    [CommonActionType.EXECUTE_ALL_CELLS]: MessageType.other,
    [CommonActionType.EXECUTE_CELL]: MessageType.other,
    [CommonActionType.EXECUTE_CELL_AND_BELOW]: MessageType.other,
    [CommonActionType.EXPORT]: MessageType.other,
    [CommonActionType.FOCUS_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.GATHER_CELL]: MessageType.other,
    [CommonActionType.GET_VARIABLE_DATA]: MessageType.other,
    [CommonActionType.GOTO_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_ABOVE_AND_FOCUS_NEW_CELL]: MessageType.other,
    [CommonActionType.INSERT_ABOVE]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_ABOVE_FIRST_AND_FOCUS_NEW_CELL]: MessageType.other,
    [CommonActionType.INSERT_ABOVE_FIRST]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_BELOW]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.INSERT_BELOW_AND_FOCUS_NEW_CELL]: MessageType.other,
    [CommonActionType.INTERRUPT_KERNEL]: MessageType.other,
    [CommonActionType.LOADED_ALL_CELLS]: MessageType.other,
    [CommonActionType.LINK_CLICK]: MessageType.other,
    [CommonActionType.MOVE_CELL_DOWN]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.MOVE_CELL_UP]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.OPEN_SETTINGS]: MessageType.other,
    [CommonActionType.RESTART_KERNEL]: MessageType.other,
    [CommonActionType.SAVE]: MessageType.other,
    [CommonActionType.SCROLL]: MessageType.syncWithLiveShare,
    [CommonActionType.SELECT_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.SELECT_SERVER]: MessageType.other,
    [CommonActionType.SEND_COMMAND]: MessageType.other,
    [CommonActionType.SHOW_DATA_VIEWER]: MessageType.other,
    [CommonActionType.SUBMIT_INPUT]: MessageType.other,
    [CommonActionType.TOGGLE_INPUT_BLOCK]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_LINE_NUMBERS]: MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_OUTPUT]: MessageType.syncWithLiveShare,
    [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: MessageType.syncWithLiveShare,
    [CommonActionType.UNFOCUS_CELL]: MessageType.syncWithLiveShare,
    [CommonActionType.UNMOUNT]: MessageType.other,
    [CommonActionType.PostOutgoingMessage]: MessageType.other,
    [CommonActionType.REFRESH_VARIABLES]: MessageType.other,
    [CommonActionType.FOCUS_INPUT]: MessageType.other,
    [CommonActionType.LOAD_IPYWIDGET_CLASS_FAILURE]: MessageType.other,
    [CommonActionType.LOAD_IPYWIDGET_CLASS_DISABLED_FAILURE]: MessageType.other,

    // Types from InteractiveWindowMessages
    [InteractiveWindowMessages.Activate]: MessageType.other,
    [InteractiveWindowMessages.AddedSysInfo]: MessageType.other,
    [InteractiveWindowMessages.CancelCompletionItemsRequest]: MessageType.other,
    [InteractiveWindowMessages.CancelHoverRequest]: MessageType.other,
    [InteractiveWindowMessages.CancelResolveCompletionItemRequest]: MessageType.other,
    [InteractiveWindowMessages.CancelSignatureHelpRequest]: MessageType.other,
    [InteractiveWindowMessages.ClearAllOutputs]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.CollapseAll]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.CopyCodeCell]: MessageType.other,
    [InteractiveWindowMessages.DeleteAllCells]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.DoSave]: MessageType.other,
    [InteractiveWindowMessages.ExecutionRendered]: MessageType.other,
    [InteractiveWindowMessages.ExpandAll]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Export]: MessageType.other,
    [InteractiveWindowMessages.FinishCell]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.FocusedCellEditor]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.GatherCodeRequest]: MessageType.other,
    [InteractiveWindowMessages.GetAllCells]: MessageType.other,
    [InteractiveWindowMessages.GetVariablesRequest]: MessageType.other,
    [InteractiveWindowMessages.GetVariablesResponse]: MessageType.other,
    [InteractiveWindowMessages.GotoCodeCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.GotoCodeCell]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.Interrupt]: MessageType.other,
    [InteractiveWindowMessages.IPyWidgetLoadFailure]: MessageType.other,
    [InteractiveWindowMessages.IPyWidgetLoadDisabled]: MessageType.other,
    [InteractiveWindowMessages.LoadAllCells]: MessageType.other,
    [InteractiveWindowMessages.LoadAllCellsComplete]: MessageType.other,
    [InteractiveWindowMessages.LoadOnigasmAssemblyRequest]: MessageType.other,
    [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: MessageType.other,
    [InteractiveWindowMessages.LoadTmLanguageRequest]: MessageType.other,
    [InteractiveWindowMessages.LoadTmLanguageResponse]: MessageType.other,
    [InteractiveWindowMessages.MonacoReady]: MessageType.other,
    [InteractiveWindowMessages.NativeCommand]: MessageType.other,
    [InteractiveWindowMessages.NotebookAddCellBelow]:
        MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.NotebookClean]: MessageType.other,
    [InteractiveWindowMessages.NotebookDirty]: MessageType.other,
    [InteractiveWindowMessages.NotebookExecutionActivated]: MessageType.other,
    [InteractiveWindowMessages.NotebookIdentity]: MessageType.other,
    [InteractiveWindowMessages.NotebookRunAllCells]: MessageType.other,
    [InteractiveWindowMessages.NotebookRunSelectedCell]: MessageType.other,
    [InteractiveWindowMessages.OpenLink]: MessageType.other,
    [InteractiveWindowMessages.OpenSettings]: MessageType.other,
    [InteractiveWindowMessages.ProvideCompletionItemsRequest]: MessageType.other,
    [InteractiveWindowMessages.ProvideCompletionItemsResponse]: MessageType.other,
    [InteractiveWindowMessages.ProvideHoverRequest]: MessageType.other,
    [InteractiveWindowMessages.ProvideHoverResponse]: MessageType.other,
    [InteractiveWindowMessages.ProvideSignatureHelpRequest]: MessageType.other,
    [InteractiveWindowMessages.ProvideSignatureHelpResponse]: MessageType.other,
    [InteractiveWindowMessages.ReExecuteCells]: MessageType.other,
    [InteractiveWindowMessages.Redo]: MessageType.other,
    [InteractiveWindowMessages.RemoteAddCode]: MessageType.other,
    [InteractiveWindowMessages.ReceivedUpdateModel]: MessageType.other,
    [InteractiveWindowMessages.RemoteReexecuteCode]: MessageType.other,
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
    [InteractiveWindowMessages.StartCell]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.StartDebugging]: MessageType.other,
    [InteractiveWindowMessages.StartProgress]: MessageType.other,
    [InteractiveWindowMessages.Started]: MessageType.other,
    [InteractiveWindowMessages.StopDebugging]: MessageType.other,
    [InteractiveWindowMessages.StopProgress]: MessageType.other,
    [InteractiveWindowMessages.SubmitNewCell]: MessageType.other,
    [InteractiveWindowMessages.Sync]: MessageType.other,
    [InteractiveWindowMessages.Undo]: MessageType.other,
    [InteractiveWindowMessages.UnfocusedCellEditor]: MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateCell]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateModel]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateKernel]: MessageType.syncAcrossSameNotebooks | MessageType.syncWithLiveShare,
    [InteractiveWindowMessages.UpdateDisplayData]: MessageType.syncWithLiveShare,
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
    [SharedMessages.UpdateSettings]: MessageType.other,
    // IpyWidgets
    [IPyWidgetMessages.IPyWidgets_kernelOptions]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_Ready]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_onRestartKernel]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_msg]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_binary_msg]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_msg_handled]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_registerCommTarget]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_MessageHookCall]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_MessageHookResult]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_RegisterMessageHook]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_RemoveMessageHook]: MessageType.noIdea,
    [IPyWidgetMessages.IPyWidgets_mirror_execute]: MessageType.noIdea
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
    if (
        messageType === undefined ||
        (messageType & MessageType.syncAcrossSameNotebooks) !== MessageType.syncAcrossSameNotebooks
    ) {
        return [false, MessageType.other];
    }

    return [
        (messageType & MessageType.syncAcrossSameNotebooks) > 0 || (messageType & MessageType.syncWithLiveShare) > 0,
        messageType
    ];
}
