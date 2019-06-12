// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { CssMessages, IGetCssRequest, IGetCssResponse, SharedMessages } from '../messages';
import { ICell, IHistoryInfo, IJupyterVariable, IJupyterVariablesResponse } from '../types';

export namespace HistoryMessages {
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
}

// These are the messages that will mirror'd to guest/hosts in
// a live share session
export const HistoryRemoteMessages : string[] = [
    HistoryMessages.AddedSysInfo,
    HistoryMessages.RemoteAddCode
];

export interface IGotoCode {
    file: string;
    line: number;
}

export interface ICopyCode {
    source: string;
}

export interface IAddedSysInfo {
    id: string;
    sysInfoCell: ICell;
}

export interface IExecuteInfo {
    code: string;
    id: string;
    file: string;
    line: number;
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

// Map all messages to specific payloads
export class IHistoryMapping {
    public [HistoryMessages.StartCell]: ICell;
    public [HistoryMessages.FinishCell]: ICell;
    public [HistoryMessages.UpdateCell]: ICell;
    public [HistoryMessages.GotoCodeCell]: IGotoCode;
    public [HistoryMessages.CopyCodeCell]: ICopyCode;
    public [HistoryMessages.RestartKernel]: never | undefined;
    public [HistoryMessages.Export]: ICell[];
    public [HistoryMessages.GetAllCells]: ICell;
    public [HistoryMessages.ReturnAllCells]: ICell[];
    public [HistoryMessages.DeleteCell]: never | undefined;
    public [HistoryMessages.DeleteAllCells]: never | undefined;
    public [HistoryMessages.Undo]: never | undefined;
    public [HistoryMessages.Redo]: never | undefined;
    public [HistoryMessages.ExpandAll]: never | undefined;
    public [HistoryMessages.CollapseAll]: never | undefined;
    public [HistoryMessages.StartProgress]: never | undefined;
    public [HistoryMessages.StopProgress]: never | undefined;
    public [HistoryMessages.Interrupt]: never | undefined;
    public [HistoryMessages.UpdateSettings]: string;
    public [HistoryMessages.SubmitNewCell]: ISubmitNewCell;
    public [HistoryMessages.SendInfo]: IHistoryInfo;
    public [HistoryMessages.Started]: never | undefined;
    public [HistoryMessages.AddedSysInfo]: IAddedSysInfo;
    public [HistoryMessages.RemoteAddCode]: IRemoteAddCode;
    public [HistoryMessages.Activate] : never | undefined;
    public [HistoryMessages.ShowDataViewer]: IShowDataViewer;
    public [HistoryMessages.GetVariablesRequest]: number;
    public [HistoryMessages.GetVariablesResponse]: IJupyterVariablesResponse;
    public [HistoryMessages.GetVariableValueRequest]: IJupyterVariable;
    public [HistoryMessages.GetVariableValueResponse]: IJupyterVariable;
    public [HistoryMessages.VariableExplorerToggle]: boolean;
    public [CssMessages.GetCssRequest] : IGetCssRequest;
    public [CssMessages.GetCssResponse] : IGetCssResponse;
    public [HistoryMessages.ProvideCompletionItemsRequest] : IProvideCompletionItemsRequest;
    public [HistoryMessages.CancelCompletionItemsRequest] : ICancelIntellisenseRequest;
    public [HistoryMessages.ProvideCompletionItemsResponse] : IProvideCompletionItemsResponse;
    public [HistoryMessages.ProvideHoverRequest] : IProvideHoverRequest;
    public [HistoryMessages.CancelHoverRequest] : ICancelIntellisenseRequest;
    public [HistoryMessages.ProvideHoverResponse] : IProvideHoverResponse;
    public [HistoryMessages.ProvideSignatureHelpRequest] : IProvideSignatureHelpRequest;
    public [HistoryMessages.CancelSignatureHelpRequest] : ICancelIntellisenseRequest;
    public [HistoryMessages.ProvideSignatureHelpResponse] : IProvideSignatureHelpResponse;
    public [HistoryMessages.AddCell] : IAddCell;
    public [HistoryMessages.EditCell] : IEditCell;
    public [HistoryMessages.RemoveCell] : IRemoveCell;
    public [HistoryMessages.LoadOnigasmAssemblyRequest]: never | undefined;
    public [HistoryMessages.LoadOnigasmAssemblyResponse]: Buffer;
    public [HistoryMessages.LoadTmLanguageRequest]: never | undefined;
    public [HistoryMessages.LoadTmLanguageResponse]: string | undefined;
    public [HistoryMessages.OpenLink]: string | undefined;
    public [HistoryMessages.ShowPlot]: string | undefined;
}
