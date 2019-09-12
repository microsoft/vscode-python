// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { CssMessages, IGetCssRequest, IGetCssResponse, SharedMessages } from '../messages';
import { ICell, IInteractiveWindowInfo, IJupyterVariable, IJupyterVariablesResponse } from '../types';

export namespace InteractiveWindowMessages {
    export const StartCell = 'start_cell';
    export const FinishCell = 'finish_cell';
    export const UpdateCell = 'update_cell';
    export const GotoCodeCell = 'gotocell_code';
    export const CopyCodeCell = 'copycell_code';
    export const RestartKernel = 'restart_kernel';
    export const Export = 'export_to_ipynb';
    export const GetAllCells = 'get_all_cells';
    export const ReturnAllCells = 'return_all_cells';
    export const DeleteCell = 'delete_cell';
    export const DeleteAllCells = 'delete_all_cells';
    export const Undo = 'undo';
    export const Redo = 'redo';
    export const ExpandAll = 'expand_all';
    export const CollapseAll = 'collapse_all';
    export const StartProgress = 'start_progress';
    export const StopProgress = 'stop_progress';
    export const Interrupt = 'interrupt';
    export const SubmitNewCell = 'submit_new_cell';
    export const UpdateSettings = SharedMessages.UpdateSettings;
    export const SendInfo = 'send_info';
    export const Started = SharedMessages.Started;
    export const AddedSysInfo = 'added_sys_info';
    export const RemoteAddCode = 'remote_add_code';
    export const Activate = 'activate';
    export const ShowDataViewer = 'show_data_explorer';
    export const GetVariablesRequest = 'get_variables_request';
    export const GetVariablesResponse = 'get_variables_response';
    export const GetVariableValueRequest = 'get_variable_value_request';
    export const GetVariableValueResponse = 'get_variable_value_response';
    export const VariableExplorerToggle = 'variable_explorer_toggle';
    export const ProvideCompletionItemsRequest = 'provide_completion_items_request';
    export const CancelCompletionItemsRequest = 'cancel_completion_items_request';
    export const ProvideCompletionItemsResponse = 'provide_completion_items_response';
    export const ProvideHoverRequest = 'provide_hover_request';
    export const CancelHoverRequest = 'cancel_hover_request';
    export const ProvideHoverResponse = 'provide_hover_response';
    export const ProvideSignatureHelpRequest = 'provide_signature_help_request';
    export const CancelSignatureHelpRequest = 'cancel_signature_help_request';
    export const ProvideSignatureHelpResponse = 'provide_signature_help_response';
    export const AddCell = 'add_cell';
    export const EditCell = 'edit_cell';
    export const RemoveCell = 'remove_cell';
    export const LoadOnigasmAssemblyRequest = 'load_onigasm_assembly_request';
    export const LoadOnigasmAssemblyResponse = 'load_onigasm_assembly_response';
    export const LoadTmLanguageRequest = 'load_tmlanguage_request';
    export const LoadTmLanguageResponse = 'load_tmlanguage_response';
    export const OpenLink = 'open_link';
    export const ShowPlot = 'show_plot';
    export const StartDebugging = 'start_debugging';
    export const StopDebugging = 'stop_debugging';
    export const GatherCode = 'gather_code';
    export const LoadAllCells = 'load_all_cells';
    export const ScrollToCell = 'scroll_to_cell';
    export const ReExecuteCell = 'reexecute_cell';
    export const NotebookIdentity = 'identity';
    export const NotebookDirty = 'dirty';
    export const NotebookClean = 'clean';
    export const SaveAll = 'save_all';
    export const NativeCommand = 'native_command';

}

export enum NativeCommandType {
    AddToEnd = 0,
    ArrowDown,
    ArrowUp,
    ChangeToCode,
    ChangeToMarkdown,
    CollapseInput,
    CollapseOutput,
    DeleteCell,
    InsertAbove,
    InsertBelow,
    MoveCellDown,
    MoveCellUp,
    Run,
    RunAbove,
    RunAll,
    RunAndAdd,
    RunAndMove,
    RunBelow,
    ToggleLineNumbers,
    ToggleOutput,
    Unfocus
}

// These are the messages that will mirror'd to guest/hosts in
// a live share session
export const InteractiveWindowRemoteMessages: string[] = [
    InteractiveWindowMessages.AddedSysInfo,
    InteractiveWindowMessages.RemoteAddCode
];

export interface IGotoCode {
    file: string;
    line: number;
}

export interface ICopyCode {
    source: string;
}

export enum SysInfoReason {
    Start,
    Restart,
    Interrupt,
    New
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

export interface ISubmitNewCell {
    code: string;
    id: string;
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
    file: string;
    id: string;
}

export interface IRemoveCell {
    id: string;
}

export interface IShowDataViewer {
    variableName: string;
    columnSize: number;
}

export interface ILoadAllCells {
    cells: ICell[];
}

export interface IScrollToCell {
    id: string;
}

export interface INotebookIdentity {
    resource: string;
}

export interface ISaveAll {
    cells: ICell[];
}

export interface INativeCommand {
    command: NativeCommandType;
    source: 'keyboard' | 'mouse';
}

// Map all messages to specific payloads
export class IInteractiveWindowMapping {
    public [InteractiveWindowMessages.StartCell]: ICell;
    public [InteractiveWindowMessages.FinishCell]: ICell;
    public [InteractiveWindowMessages.UpdateCell]: ICell;
    public [InteractiveWindowMessages.GotoCodeCell]: IGotoCode;
    public [InteractiveWindowMessages.CopyCodeCell]: ICopyCode;
    public [InteractiveWindowMessages.RestartKernel]: never | undefined;
    public [InteractiveWindowMessages.Export]: ICell[];
    public [InteractiveWindowMessages.GetAllCells]: ICell;
    public [InteractiveWindowMessages.ReturnAllCells]: ICell[];
    public [InteractiveWindowMessages.DeleteCell]: never | undefined;
    public [InteractiveWindowMessages.DeleteAllCells]: never | undefined;
    public [InteractiveWindowMessages.Undo]: never | undefined;
    public [InteractiveWindowMessages.Redo]: never | undefined;
    public [InteractiveWindowMessages.ExpandAll]: never | undefined;
    public [InteractiveWindowMessages.CollapseAll]: never | undefined;
    public [InteractiveWindowMessages.StartProgress]: never | undefined;
    public [InteractiveWindowMessages.StopProgress]: never | undefined;
    public [InteractiveWindowMessages.Interrupt]: never | undefined;
    public [InteractiveWindowMessages.UpdateSettings]: string;
    public [InteractiveWindowMessages.SubmitNewCell]: ISubmitNewCell;
    public [InteractiveWindowMessages.SendInfo]: IInteractiveWindowInfo;
    public [InteractiveWindowMessages.Started]: never | undefined;
    public [InteractiveWindowMessages.AddedSysInfo]: IAddedSysInfo;
    public [InteractiveWindowMessages.RemoteAddCode]: IRemoteAddCode;
    public [InteractiveWindowMessages.Activate]: never | undefined;
    public [InteractiveWindowMessages.ShowDataViewer]: IShowDataViewer;
    public [InteractiveWindowMessages.GetVariablesRequest]: number;
    public [InteractiveWindowMessages.GetVariablesResponse]: IJupyterVariablesResponse;
    public [InteractiveWindowMessages.GetVariableValueRequest]: IJupyterVariable;
    public [InteractiveWindowMessages.GetVariableValueResponse]: IJupyterVariable;
    public [InteractiveWindowMessages.VariableExplorerToggle]: boolean;
    public [CssMessages.GetCssRequest]: IGetCssRequest;
    public [CssMessages.GetCssResponse]: IGetCssResponse;
    public [InteractiveWindowMessages.ProvideCompletionItemsRequest]: IProvideCompletionItemsRequest;
    public [InteractiveWindowMessages.CancelCompletionItemsRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideCompletionItemsResponse]: IProvideCompletionItemsResponse;
    public [InteractiveWindowMessages.ProvideHoverRequest]: IProvideHoverRequest;
    public [InteractiveWindowMessages.CancelHoverRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideHoverResponse]: IProvideHoverResponse;
    public [InteractiveWindowMessages.ProvideSignatureHelpRequest]: IProvideSignatureHelpRequest;
    public [InteractiveWindowMessages.CancelSignatureHelpRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideSignatureHelpResponse]: IProvideSignatureHelpResponse;
    public [InteractiveWindowMessages.AddCell]: IAddCell;
    public [InteractiveWindowMessages.EditCell]: IEditCell;
    public [InteractiveWindowMessages.RemoveCell]: IRemoveCell;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyRequest]: never | undefined;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: Buffer;
    public [InteractiveWindowMessages.LoadTmLanguageRequest]: never | undefined;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: string | undefined;
    public [InteractiveWindowMessages.OpenLink]: string | undefined;
    public [InteractiveWindowMessages.ShowPlot]: string | undefined;
    public [InteractiveWindowMessages.StartDebugging]: never | undefined;
    public [InteractiveWindowMessages.StopDebugging]: never | undefined;
    public [InteractiveWindowMessages.GatherCode]: ICell;
    public [InteractiveWindowMessages.LoadAllCells]: ILoadAllCells;
    public [InteractiveWindowMessages.ScrollToCell]: IScrollToCell;
    public [InteractiveWindowMessages.ReExecuteCell]: ISubmitNewCell;
    public [InteractiveWindowMessages.NotebookIdentity]: INotebookIdentity;
    public [InteractiveWindowMessages.NotebookDirty]: never | undefined;
    public [InteractiveWindowMessages.NotebookClean]: never | undefined;
    public [InteractiveWindowMessages.SaveAll]: ISaveAll;
    public [InteractiveWindowMessages.NativeCommand]: INativeCommand;
}
