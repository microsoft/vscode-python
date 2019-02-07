// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ICell, InterruptResult } from '../../types';


export enum ServerResponseType {
    ExecuteObservable,
    Interrupt,
    Restart,
    Exception
}

export class ServerResponse {
    type: ServerResponseType;
    time: number;
}


export class ExecuteObservableResponse extends ServerResponse {
    type: ServerResponseType = ServerResponseType.ExecuteObservable;
    pos: number;
    code: string;
    id: string; // Unique id so guest side can tell what observable it belongs with
    cells: ICell[];
}

export class InterruptResponse extends ServerResponse {
    type: ServerResponseType = ServerResponseType.Interrupt;
    result: InterruptResult;
}

export class RestartResponse extends ServerResponse {
    type: ServerResponseType = ServerResponseType.Restart;
}

export class ExceptionResponse extends ServerResponse {
    type: ServerResponseType = ServerResponseType.Exception;
    message: string;
}

// Map all responses to their properties
export interface IResponseMapping {
    [ServerResponseType.ExecuteObservable]: ExecuteObservableResponse;
    [ServerResponseType.Interrupt]: InterruptResponse;
    [ServerResponseType.Restart]: RestartResponse;
    [ServerResponseType.Exception]: ExceptionResponse;
}

export interface ICatchupRequest {
    since: number;
}

