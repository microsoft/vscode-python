// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONObject } from '@phosphor/coreutils';

import { IJupyterVariable } from '../types';

export const RowFetchAllLimit = 1000;
export const RowFetchSizeFirst = 100;
export const RowFetchSizeSubsequent = 1000;
export const MaxStringCompare = 200;

export namespace DataExplorerRowStates {
    export const Fetching = 'fetching';
    export const Skipped = 'skipped';
}

export namespace DataExplorerMessages {
    export const Started = 'started';
    export const UpdateSettings = 'update_settings';
    export const InitializeData = 'init';
    export const GetAllRowsRequest = 'get_all_rows_request';
    export const GetAllRowsResponse = 'get_all_rows_response';
    export const GetRowsRequest = 'get_rows_request';
    export const GetRowsResponse = 'get_rows_response';
}

export interface IGetRowsRequest {
    start: number;
    end: number;
}

export interface IGetRowsResponse {
    rows: JSONObject;
    start: number;
    end: number;
}

// Map all messages to specific payloads
export class IDataExplorerMapping {
    public [DataExplorerMessages.Started]: never | undefined;
    public [DataExplorerMessages.UpdateSettings]: string;
    public [DataExplorerMessages.InitializeData]: IJupyterVariable;
    public [DataExplorerMessages.GetAllRowsRequest]: never | undefined;
    public [DataExplorerMessages.GetAllRowsResponse]: JSONObject;
    public [DataExplorerMessages.GetRowsRequest]: IGetRowsRequest;
    public [DataExplorerMessages.GetRowsResponse]: IGetRowsResponse;
}
