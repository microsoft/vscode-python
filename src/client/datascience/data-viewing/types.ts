// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { JSONObject } from '@phosphor/coreutils';

import { IJupyterVariable } from '../types';

export const RowFetchAllLimit = 1000;
export const RowFetchSizeFirst = 100;
export const RowFetchSizeSubsequent = 1000;
export const MaxStringCompare = 200;

export namespace DataViewerRowStates {
    export const Fetching = 'fetching';
    export const Skipped = 'skipped';
}

export namespace DataViewerMessages {
    export const Started = 'started';
    export const UpdateSettings = 'update_settings';
    export const InitializeData = 'init';
    export const GetAllRowsRequest = 'get_all_rows_request';
    export const GetAllRowsResponse = 'get_all_rows_response';
    export const GetRowsRequest = 'get_rows_request';
    export const GetRowsResponse = 'get_rows_response';
    export const CompletedData = 'complete';
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
export class IDataViewerMapping {
    public [DataViewerMessages.Started]: never | undefined;
    public [DataViewerMessages.UpdateSettings]: string;
    public [DataViewerMessages.InitializeData]: IJupyterVariable;
    public [DataViewerMessages.GetAllRowsRequest]: never | undefined;
    public [DataViewerMessages.GetAllRowsResponse]: JSONObject;
    public [DataViewerMessages.GetRowsRequest]: IGetRowsRequest;
    public [DataViewerMessages.GetRowsResponse]: IGetRowsResponse;
    public [DataViewerMessages.CompletedData]: never | undefined;
}
