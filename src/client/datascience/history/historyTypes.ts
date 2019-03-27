// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ICell, IHistoryInfo, IJupyterVariable } from '../types';

export namespace HistoryMessages {
    export const StartCell = 'start_cell';
    export const FinishCell = 'finish_cell';
    export const UpdateCell = 'update_cell';
    export const GotoCodeCell = 'gotocell_code';
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
    export const UpdateSettings = 'update_settings';
    export const SendInfo = 'send_info';
    export const Started = 'started';
    export const AddedSysInfo = 'added_sys_info';
    export const RemoteAddCode = 'remote_add_code';
    export const Activate = 'activate';
    export const ShowDataExplorer = 'show_data_explorer';
    export const GetVariablesRequest = 'get_variables_request';
    export const GetVariablesResponse = 'get_variables_response';
    export const GetVariableValueRequest = 'get_variable_value_request';
    export const GetVariableValueResponse = 'get_variable_value_response';
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

// Map all messages to specific payloads
export class IHistoryMapping {
    public [HistoryMessages.StartCell]: ICell;
    public [HistoryMessages.FinishCell]: ICell;
    public [HistoryMessages.UpdateCell]: ICell;
    public [HistoryMessages.GotoCodeCell]: IGotoCode;
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
    public [HistoryMessages.ShowDataExplorer]: string;
    public [HistoryMessages.GetVariablesRequest]: never | undefined;
    public [HistoryMessages.GetVariablesResponse]: IJupyterVariable[];
    public [HistoryMessages.GetVariableValueRequest]: IJupyterVariable;
    public [HistoryMessages.GetVariableValueResponse]: IJupyterVariable;
}
