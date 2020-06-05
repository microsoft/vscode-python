// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Uri } from 'vscode';
import { DebugState, IServerState } from '../../../datascience-ui/interactive-common/mainState';

import type { KernelMessage } from '@jupyterlab/services';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
    CommonActionType,
    IAddCellAction,
    ILoadIPyWidgetClassFailureAction,
    IVariableExplorerHeight,
    LoadIPyWidgetClassLoadAction,
    NotifyIPyWidgeWidgetVersionNotSupportedAction
} from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { Resource } from '../../common/types';
import { PythonInterpreter } from '../../pythonEnvironments/discovery/types';
import { NativeKeyboardCommandTelemetry, NativeMouseCommandTelemetry } from '../constants';
import { WidgetScriptSource } from '../ipywidgets/types';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { CssMessages, IGetCssRequest, IGetCssResponse, IGetMonacoThemeRequest, SharedMessages } from '../messages';
import { IGetMonacoThemeResponse } from '../monacoMessages';
import {
    ICell,
    IInteractiveWindowInfo,
    IJupyterKernelSpec,
    IJupyterVariable,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse,
    INotebookModel,
    KernelSocketOptions
} from '../types';
import { BaseReduxActionPayload } from './types';

export enum InteractiveWindowMessages {
    StartCell = 'start_cell',
    FinishCell = 'finish_cell',
    UpdateCellWithExecutionResults = 'UpdateCellWithExecutionResults',
    GotoCodeCell = 'gotocell_code',
    CopyCodeCell = 'copycell_code',
    NotebookExecutionActivated = 'notebook_execution_activated',
    RestartKernel = 'restart_kernel',
    Export = 'export_to_ipynb',
    GetAllCells = 'get_all_cells',
    ReturnAllCells = 'return_all_cells',
    DeleteAllCells = 'delete_all_cells',
    Undo = 'undo',
    Redo = 'redo',
    ExpandAll = 'expand_all',
    CollapseAll = 'collapse_all',
    StartProgress = 'start_progress',
    StopProgress = 'stop_progress',
    Interrupt = 'interrupt',
    SubmitNewCell = 'submit_new_cell',
    SettingsUpdated = 'settings_updated',
    // Message sent to React component from extension asking it to save the notebook.
    DoSave = 'DoSave',
    SendInfo = 'send_info',
    Started = 'started',
    ConvertUriForUseInWebViewRequest = 'ConvertUriForUseInWebViewRequest',
    ConvertUriForUseInWebViewResponse = 'ConvertUriForUseInWebViewResponse',
    AddedSysInfo = 'added_sys_info',
    RemoteAddCode = 'remote_add_code',
    RemoteReexecuteCode = 'remote_reexecute_code',
    Activate = 'activate',
    ShowDataViewer = 'show_data_explorer',
    GetVariablesRequest = 'get_variables_request',
    GetVariablesResponse = 'get_variables_response',
    VariableExplorerToggle = 'variable_explorer_toggle',
    SetVariableExplorerHeight = 'set_variable_explorer_height',
    VariableExplorerHeightResponse = 'variable_explorer_height_response',
    ForceVariableRefresh = 'force_variable_refresh',
    ProvideCompletionItemsRequest = 'provide_completion_items_request',
    CancelCompletionItemsRequest = 'cancel_completion_items_request',
    ProvideCompletionItemsResponse = 'provide_completion_items_response',
    ProvideHoverRequest = 'provide_hover_request',
    CancelHoverRequest = 'cancel_hover_request',
    ProvideHoverResponse = 'provide_hover_response',
    ProvideSignatureHelpRequest = 'provide_signature_help_request',
    CancelSignatureHelpRequest = 'cancel_signature_help_request',
    ProvideSignatureHelpResponse = 'provide_signature_help_response',
    ResolveCompletionItemRequest = 'resolve_completion_item_request',
    CancelResolveCompletionItemRequest = 'cancel_resolve_completion_item_request',
    ResolveCompletionItemResponse = 'resolve_completion_item_response',
    Sync = 'sync_message_used_to_broadcast_and_sync_editors',
    LoadOnigasmAssemblyRequest = 'load_onigasm_assembly_request',
    LoadOnigasmAssemblyResponse = 'load_onigasm_assembly_response',
    LoadTmLanguageRequest = 'load_tmlanguage_request',
    LoadTmLanguageResponse = 'load_tmlanguage_response',
    OpenLink = 'open_link',
    ShowPlot = 'show_plot',
    SavePng = 'save_png',
    StartDebugging = 'start_debugging',
    StopDebugging = 'stop_debugging',
    GatherCode = 'gather_code',
    GatherCodeToScript = 'gather_code_to_script',
    LoadAllCells = 'load_all_cells',
    LoadAllCellsComplete = 'load_all_cells_complete',
    ScrollToCell = 'scroll_to_cell',
    ReExecuteCells = 'reexecute_cells',
    NotebookIdentity = 'identity',
    NotebookClose = 'close',
    NotebookDirty = 'dirty',
    NotebookClean = 'clean',
    SaveAll = 'save_all',
    NativeCommand = 'native_command',
    VariablesComplete = 'variables_complete',
    NotebookRunAllCells = 'notebook_run_all_cells',
    NotebookRunSelectedCell = 'notebook_run_selected_cell',
    NotebookAddCellBelow = 'notebook_add_cell_below',
    ExecutionRendered = 'rendered_execution',
    FocusedCellEditor = 'focused_cell_editor',
    SelectedCell = 'selected_cell',
    OutputToggled = 'output_toggled',
    UnfocusedCellEditor = 'unfocused_cell_editor',
    MonacoReady = 'monaco_ready',
    ClearAllOutputs = 'clear_all_outputs',
    SelectKernel = 'select_kernel',
    UpdateKernel = 'update_kernel',
    SelectJupyterServer = 'select_jupyter_server',
    UpdateModel = 'update_model',
    ReceivedUpdateModel = 'received_update_model',
    OpenSettings = 'open_settings',
    UpdateDisplayData = 'update_display_data',
    IPyWidgetLoadSuccess = 'ipywidget_load_success',
    IPyWidgetLoadFailure = 'ipywidget_load_failure',
    IPyWidgetRenderFailure = 'ipywidget_render_failure',
    IPyWidgetUnhandledKernelMessage = 'ipywidget_unhandled_kernel_message',
    IPyWidgetWidgetVersionNotSupported = 'ipywidget_widget_version_not_supported',
    RunByLine = 'run_by_line',
    Step = 'step',
    Continue = 'continue',
    ShowContinue = 'show_continue',
    ShowBreak = 'show_break',
    ShowingIp = 'showing_ip',
    DebugStateChange = 'debug_state_change',
    KernelIdle = 'kernel_idle'
}

export enum IPyWidgetMessages {
    IPyWidgets_Ready = 'IPyWidgets_Ready',
    IPyWidgets_onRestartKernel = 'IPyWidgets_onRestartKernel',
    IPyWidgets_onKernelChanged = 'IPyWidgets_onKernelChanged',
    IPyWidgets_updateRequireConfig = 'IPyWidgets_updateRequireConfig',
    /**
     * UI sends a request to extension to determine whether we have the source for any of the widgets.
     */
    IPyWidgets_WidgetScriptSourceRequest = 'IPyWidgets_WidgetScriptSourceRequest',
    /**
     * Extension sends response to the request with yes/no.
     */
    IPyWidgets_WidgetScriptSourceResponse = 'IPyWidgets_WidgetScriptSourceResponse',
    IPyWidgets_msg = 'IPyWidgets_msg',
    IPyWidgets_binary_msg = 'IPyWidgets_binary_msg',
    IPyWidgets_msg_handled = 'IPyWidgets_msg_handled',
    IPyWidgets_kernelOptions = 'IPyWidgets_kernelOptions',
    IPyWidgets_registerCommTarget = 'IPyWidgets_registerCommTarget',
    IPyWidgets_RegisterMessageHook = 'IPyWidgets_RegisterMessageHook',
    IPyWidgets_RemoveMessageHook = 'IPyWidgets_RemoveMessageHook',
    IPyWidgets_MessageHookCall = 'IPyWidgets_MessageHookCall',
    IPyWidgets_MessageHookResult = 'IPyWidgets_MessageHookResult',
    IPyWidgets_mirror_execute = 'IPyWidgets_mirror_execute'
}

// These are the messages that will mirror'd to guest/hosts in
// a live share session
export const InteractiveWindowRemoteMessages: string[] = [
    InteractiveWindowMessages.AddedSysInfo.toString(),
    InteractiveWindowMessages.RemoteAddCode.toString(),
    InteractiveWindowMessages.RemoteReexecuteCode.toString()
];

export interface IGotoCode {
    file: string;
    line: number;
}

export interface ICopyCode {
    source: string;
}

export enum VariableExplorerStateKeys {
    height = 'NBVariableHeights'
}

export enum SysInfoReason {
    Start,
    Restart,
    Interrupt,
    New,
    Connect
}

export interface IAddedSysInfo {
    type: SysInfoReason;
    id: string;
    sysInfoCell: ICell;
}

export interface IExecuteInfo {
    code: string;
    id: string;
    file: string;
    line: number;
    debug: boolean;
}

export interface IRemoteAddCode extends IExecuteInfo {
    originator: string;
}

export interface IRemoteReexecuteCode extends IExecuteInfo {
    originator: string;
}

export interface ISubmitNewCell {
    code: string;
    id: string;
}

export interface IReExecuteCells {
    cellIds: string[];
}

export interface IProvideCompletionItemsRequest {
    position: monacoEditor.Position;
    context: monacoEditor.languages.CompletionContext;
    requestId: string;
    cellId: string;
}

export interface IProvideHoverRequest {
    position: monacoEditor.Position;
    requestId: string;
    cellId: string;
    wordAtPosition: string | undefined;
}

export interface IProvideSignatureHelpRequest {
    position: monacoEditor.Position;
    context: monacoEditor.languages.SignatureHelpContext;
    requestId: string;
    cellId: string;
}

export interface ICancelIntellisenseRequest {
    requestId: string;
}

export interface IResolveCompletionItemRequest {
    position: monacoEditor.Position;
    item: monacoEditor.languages.CompletionItem;
    requestId: string;
    cellId: string;
}

export interface IProvideCompletionItemsResponse {
    list: monacoEditor.languages.CompletionList;
    requestId: string;
}

export interface IProvideHoverResponse {
    hover: monacoEditor.languages.Hover;
    requestId: string;
}

export interface IProvideSignatureHelpResponse {
    signatureHelp: monacoEditor.languages.SignatureHelp;
    requestId: string;
}

export interface IResolveCompletionItemResponse {
    item: monacoEditor.languages.CompletionItem;
    requestId: string;
}

export interface IPosition {
    line: number;
    ch: number;
}

export interface IEditCell {
    changes: monacoEditor.editor.IModelContentChange[];
    id: string;
}

export interface IAddCell {
    fullText: string;
    currentText: string;
    cell: ICell;
}

export interface IRemoveCell {
    id: string;
}

export interface ISwapCells {
    firstCellId: string;
    secondCellId: string;
}

export interface IInsertCell {
    cell: ICell;
    code: string;
    index: number;
    codeCellAboveId: string | undefined;
}

export interface IShowDataViewer {
    variable: IJupyterVariable;
    columnSize: number;
}

export interface IRefreshVariablesRequest {
    newExecutionCount?: number;
}

export interface ILoadAllCells {
    cells: ICell[];
}

export interface IScrollToCell {
    id: string;
}

export interface INotebookIdentity {
    resource: Uri;
    type: 'interactive' | 'native';
}

export interface ISaveAll {
    cells: ICell[];
}

export interface INativeCommand {
    command: NativeKeyboardCommandTelemetry | NativeMouseCommandTelemetry;
}

export interface IRenderComplete {
    ids: string[];
}

export interface IDebugStateChange {
    oldState: DebugState;
    newState: DebugState;
}

export interface IFocusedCellEditor {
    cellId: string;
}

export interface INotebookModelChange {
    oldDirty: boolean;
    newDirty: boolean;
    source: 'undo' | 'user' | 'redo';
    model?: INotebookModel;
}

export interface INotebookModelSaved extends INotebookModelChange {
    kind: 'save';
}
export interface INotebookModelSavedAs extends INotebookModelChange {
    kind: 'saveAs';
    target: Uri;
    sourceUri: Uri;
}

export interface INotebookModelRemoveAllChange extends INotebookModelChange {
    kind: 'remove_all';
    oldCells: ICell[];
    newCellId: string;
}
export interface INotebookModelModifyChange extends INotebookModelChange {
    kind: 'modify';
    newCells: ICell[];
    oldCells: ICell[];
}
export interface INotebookModelCellExecutionCountChange extends INotebookModelChange {
    kind: 'updateCellExecutionCount';
    cellId: string;
    executionCount?: number;
}

export interface INotebookModelClearChange extends INotebookModelChange {
    kind: 'clear';
    oldCells: ICell[];
}

export interface INotebookModelSwapChange extends INotebookModelChange {
    kind: 'swap';
    firstCellId: string;
    secondCellId: string;
}

export interface INotebookModelRemoveChange extends INotebookModelChange {
    kind: 'remove';
    cell: ICell;
    index: number;
}

export interface INotebookModelInsertChange extends INotebookModelChange {
    kind: 'insert';
    cell: ICell;
    index: number;
    codeCellAboveId?: string;
}

export interface INotebookModelAddChange extends INotebookModelChange {
    kind: 'add';
    cell: ICell;
    fullText: string;
    currentText: string;
}

export interface INotebookModelChangeTypeChange extends INotebookModelChange {
    kind: 'changeCellType';
    cell: ICell;
}

export interface IEditorPosition {
    /**
     * line number (starts at 1)
     */
    readonly lineNumber: number;
    /**
     * column (the first character in a line is between column 1 and column 2)
     */
    readonly column: number;
}

export interface IEditorRange {
    /**
     * Line number on which the range starts (starts at 1).
     */
    readonly startLineNumber: number;
    /**
     * Column on which the range starts in line `startLineNumber` (starts at 1).
     */
    readonly startColumn: number;
    /**
     * Line number on which the range ends.
     */
    readonly endLineNumber: number;
    /**
     * Column on which the range ends in line `endLineNumber`.
     */
    readonly endColumn: number;
}

export interface IEditorContentChange {
    /**
     * The range that got replaced.
     */
    readonly range: IEditorRange;
    /**
     * The offset of the range that got replaced.
     */
    readonly rangeOffset: number;
    /**
     * The length of the range that got replaced.
     */
    readonly rangeLength: number;
    /**
     * The new text for the range.
     */
    readonly text: string;
    /**
     * The cursor position to be set after the change
     */
    readonly position: IEditorPosition;
}

export interface INotebookModelEditChange extends INotebookModelChange {
    kind: 'edit';
    forward: IEditorContentChange[];
    reverse: IEditorContentChange[];
    id: string;
}

export interface INotebookModelVersionChange extends INotebookModelChange {
    kind: 'version';
    interpreter: PythonInterpreter | undefined;
    kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined;
}

export type NotebookModelChange =
    | INotebookModelSaved
    | INotebookModelSavedAs
    | INotebookModelModifyChange
    | INotebookModelRemoveAllChange
    | INotebookModelClearChange
    | INotebookModelSwapChange
    | INotebookModelRemoveChange
    | INotebookModelInsertChange
    | INotebookModelAddChange
    | INotebookModelEditChange
    | INotebookModelVersionChange
    | INotebookModelChangeTypeChange
    | INotebookModelCellExecutionCountChange;

export interface IRunByLine {
    cell: ICell;
    expectedExecutionCount: number;
}

export interface ILoadTmLanguageResponse {
    languageId: string;
    scopeName: string; // Name in the tmlanguage scope file (scope.python instead of python)
    // tslint:disable-next-line: no-any
    languageConfiguration: any; // Should actually be of type monacoEditor.languages.LanguageConfiguration but don't want to pull in all those types here.
    languageJSON: string; // Contents of the tmLanguage.json file
    extensions: string[]; // Array of file extensions that map to this language
}

// Map all messages to specific payloads
export class IInteractiveWindowMapping {
    public [IPyWidgetMessages.IPyWidgets_kernelOptions]: KernelSocketOptions;
    public [IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest]: { moduleName: string; moduleVersion: string };
    public [IPyWidgetMessages.IPyWidgets_WidgetScriptSourceResponse]: WidgetScriptSource;
    public [IPyWidgetMessages.IPyWidgets_Ready]: never | undefined;
    public [IPyWidgetMessages.IPyWidgets_onRestartKernel]: never | undefined;
    public [IPyWidgetMessages.IPyWidgets_onKernelChanged]: never | undefined;
    public [IPyWidgetMessages.IPyWidgets_registerCommTarget]: string;
    // tslint:disable-next-line: no-any
    public [IPyWidgetMessages.IPyWidgets_binary_msg]: { id: string; data: any };
    public [IPyWidgetMessages.IPyWidgets_msg]: { id: string; data: string };
    public [IPyWidgetMessages.IPyWidgets_msg_handled]: { id: string };
    public [IPyWidgetMessages.IPyWidgets_RegisterMessageHook]: string;
    public [IPyWidgetMessages.IPyWidgets_RemoveMessageHook]: { hookMsgId: string; lastHookedMsgId: string | undefined };
    public [IPyWidgetMessages.IPyWidgets_MessageHookCall]: {
        requestId: string;
        parentId: string;
        msg: KernelMessage.IIOPubMessage;
    };
    public [IPyWidgetMessages.IPyWidgets_MessageHookResult]: {
        requestId: string;
        parentId: string;
        msgType: string;
        result: boolean;
    };
    public [IPyWidgetMessages.IPyWidgets_mirror_execute]: { id: string; msg: KernelMessage.IExecuteRequestMsg };
    public [InteractiveWindowMessages.StartCell]: ICell;
    public [InteractiveWindowMessages.ForceVariableRefresh]: never | undefined;
    public [InteractiveWindowMessages.FinishCell]: ICell;
    public [InteractiveWindowMessages.UpdateCellWithExecutionResults]: ICell;
    public [InteractiveWindowMessages.GotoCodeCell]: IGotoCode;
    public [InteractiveWindowMessages.CopyCodeCell]: ICopyCode;
    public [InteractiveWindowMessages.NotebookExecutionActivated]: INotebookIdentity & { owningResource: Resource };
    public [InteractiveWindowMessages.RestartKernel]: never | undefined;
    public [InteractiveWindowMessages.SelectKernel]: IServerState | undefined;
    public [InteractiveWindowMessages.SelectJupyterServer]: never | undefined;
    public [InteractiveWindowMessages.OpenSettings]: string | undefined;
    public [InteractiveWindowMessages.Export]: ICell[];
    public [InteractiveWindowMessages.GetAllCells]: never | undefined;
    public [InteractiveWindowMessages.ReturnAllCells]: ICell[];
    public [InteractiveWindowMessages.DeleteAllCells]: IAddCellAction;
    public [InteractiveWindowMessages.Undo]: never | undefined;
    public [InteractiveWindowMessages.Redo]: never | undefined;
    public [InteractiveWindowMessages.ExpandAll]: never | undefined;
    public [InteractiveWindowMessages.CollapseAll]: never | undefined;
    public [InteractiveWindowMessages.StartProgress]: never | undefined;
    public [InteractiveWindowMessages.StopProgress]: never | undefined;
    public [InteractiveWindowMessages.Interrupt]: never | undefined;
    public [InteractiveWindowMessages.SettingsUpdated]: string;
    public [InteractiveWindowMessages.SubmitNewCell]: ISubmitNewCell;
    public [InteractiveWindowMessages.SendInfo]: IInteractiveWindowInfo;
    public [InteractiveWindowMessages.Started]: never | undefined;
    public [InteractiveWindowMessages.AddedSysInfo]: IAddedSysInfo;
    public [InteractiveWindowMessages.RemoteAddCode]: IRemoteAddCode;
    public [InteractiveWindowMessages.RemoteReexecuteCode]: IRemoteReexecuteCode;
    public [InteractiveWindowMessages.Activate]: never | undefined;
    public [InteractiveWindowMessages.ShowDataViewer]: IShowDataViewer;
    public [InteractiveWindowMessages.GetVariablesRequest]: IJupyterVariablesRequest;
    public [InteractiveWindowMessages.GetVariablesResponse]: IJupyterVariablesResponse;
    public [InteractiveWindowMessages.VariableExplorerToggle]: boolean;
    public [InteractiveWindowMessages.SetVariableExplorerHeight]: IVariableExplorerHeight;
    public [InteractiveWindowMessages.VariableExplorerHeightResponse]: IVariableExplorerHeight;
    public [CssMessages.GetCssRequest]: IGetCssRequest;
    public [CssMessages.GetCssResponse]: IGetCssResponse;
    public [CssMessages.GetMonacoThemeRequest]: IGetMonacoThemeRequest;
    public [CssMessages.GetMonacoThemeResponse]: IGetMonacoThemeResponse;
    public [InteractiveWindowMessages.ProvideCompletionItemsRequest]: IProvideCompletionItemsRequest;
    public [InteractiveWindowMessages.CancelCompletionItemsRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideCompletionItemsResponse]: IProvideCompletionItemsResponse;
    public [InteractiveWindowMessages.ProvideHoverRequest]: IProvideHoverRequest;
    public [InteractiveWindowMessages.CancelHoverRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideHoverResponse]: IProvideHoverResponse;
    public [InteractiveWindowMessages.ProvideSignatureHelpRequest]: IProvideSignatureHelpRequest;
    public [InteractiveWindowMessages.CancelSignatureHelpRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideSignatureHelpResponse]: IProvideSignatureHelpResponse;
    public [InteractiveWindowMessages.ResolveCompletionItemRequest]: IResolveCompletionItemRequest;
    public [InteractiveWindowMessages.CancelResolveCompletionItemRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ResolveCompletionItemResponse]: IResolveCompletionItemResponse;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyRequest]: never | undefined;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: Buffer;
    public [InteractiveWindowMessages.LoadTmLanguageRequest]: string;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: ILoadTmLanguageResponse;
    public [InteractiveWindowMessages.OpenLink]: string | undefined;
    public [InteractiveWindowMessages.ShowPlot]: string | undefined;
    public [InteractiveWindowMessages.SavePng]: string | undefined;
    public [InteractiveWindowMessages.StartDebugging]: never | undefined;
    public [InteractiveWindowMessages.StopDebugging]: never | undefined;
    public [InteractiveWindowMessages.GatherCode]: ICell;
    public [InteractiveWindowMessages.GatherCodeToScript]: ICell;
    public [InteractiveWindowMessages.LoadAllCells]: ILoadAllCells;
    public [InteractiveWindowMessages.LoadAllCellsComplete]: ILoadAllCells;
    public [InteractiveWindowMessages.ScrollToCell]: IScrollToCell;
    public [InteractiveWindowMessages.ReExecuteCells]: IReExecuteCells;
    public [InteractiveWindowMessages.NotebookIdentity]: INotebookIdentity;
    public [InteractiveWindowMessages.NotebookClose]: INotebookIdentity;
    public [InteractiveWindowMessages.NotebookDirty]: never | undefined;
    public [InteractiveWindowMessages.NotebookClean]: never | undefined;
    public [InteractiveWindowMessages.SaveAll]: ISaveAll;
    public [InteractiveWindowMessages.Sync]: {
        type: InteractiveWindowMessages | SharedMessages | CommonActionType;
        // tslint:disable-next-line: no-any
        payload: BaseReduxActionPayload<any>;
    };
    public [InteractiveWindowMessages.NativeCommand]: INativeCommand;
    public [InteractiveWindowMessages.VariablesComplete]: never | undefined;
    public [InteractiveWindowMessages.NotebookRunAllCells]: never | undefined;
    public [InteractiveWindowMessages.NotebookRunSelectedCell]: never | undefined;
    public [InteractiveWindowMessages.NotebookAddCellBelow]: IAddCellAction;
    public [InteractiveWindowMessages.DoSave]: never | undefined;
    public [InteractiveWindowMessages.ExecutionRendered]: IRenderComplete;
    public [InteractiveWindowMessages.FocusedCellEditor]: IFocusedCellEditor;
    public [InteractiveWindowMessages.SelectedCell]: IFocusedCellEditor;
    public [InteractiveWindowMessages.OutputToggled]: never | undefined;
    public [InteractiveWindowMessages.UnfocusedCellEditor]: never | undefined;
    public [InteractiveWindowMessages.MonacoReady]: never | undefined;
    public [InteractiveWindowMessages.ClearAllOutputs]: never | undefined;
    public [InteractiveWindowMessages.UpdateKernel]: IServerState | undefined;
    public [InteractiveWindowMessages.UpdateModel]: NotebookModelChange;
    public [InteractiveWindowMessages.ReceivedUpdateModel]: never | undefined;
    public [SharedMessages.UpdateSettings]: string;
    public [SharedMessages.LocInit]: string;
    public [InteractiveWindowMessages.UpdateDisplayData]: KernelMessage.IUpdateDisplayDataMsg;
    public [InteractiveWindowMessages.IPyWidgetLoadSuccess]: LoadIPyWidgetClassLoadAction;
    public [InteractiveWindowMessages.IPyWidgetLoadFailure]: ILoadIPyWidgetClassFailureAction;
    public [InteractiveWindowMessages.IPyWidgetWidgetVersionNotSupported]: NotifyIPyWidgeWidgetVersionNotSupportedAction;
    public [InteractiveWindowMessages.ConvertUriForUseInWebViewRequest]: Uri;
    public [InteractiveWindowMessages.ConvertUriForUseInWebViewResponse]: { request: Uri; response: Uri };
    public [InteractiveWindowMessages.IPyWidgetRenderFailure]: Error;
    public [InteractiveWindowMessages.IPyWidgetUnhandledKernelMessage]: KernelMessage.IMessage;
    public [InteractiveWindowMessages.RunByLine]: IRunByLine;
    public [InteractiveWindowMessages.Continue]: never | undefined;
    public [InteractiveWindowMessages.ShowBreak]: { frames: DebugProtocol.StackFrame[]; cell: ICell };
    public [InteractiveWindowMessages.ShowContinue]: ICell;
    public [InteractiveWindowMessages.Step]: never | undefined;
    public [InteractiveWindowMessages.ShowingIp]: never | undefined;
    public [InteractiveWindowMessages.KernelIdle]: never | undefined;
    public [InteractiveWindowMessages.DebugStateChange]: IDebugStateChange;
}
