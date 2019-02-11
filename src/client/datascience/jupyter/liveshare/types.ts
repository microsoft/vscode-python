// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ICell, InterruptResult } from '../../types';

// tslint:disable:max-classes-per-file

export enum ServerResponseType {
    ExecuteObservable,
    Interrupt,
    Restart,
    Exception
}

export interface IServerResponse {
    type: ServerResponseType;
    time: number;
}

export interface IExecuteObservableResponse extends IServerResponse {
    pos: number;
    code: string;
    id: string; // Unique id so guest side can tell what observable it belongs with
    cells: ICell[] | undefined;
}

export interface IInterruptResponse extends IServerResponse {
    result: InterruptResult;
}

export interface IRestartResponse extends IServerResponse {
}

export interface IExceptionResponse extends IServerResponse {
    message: string;
}

// Map all responses to their properties
export interface IResponseMapping {
    [ServerResponseType.ExecuteObservable]: IExecuteObservableResponse;
    [ServerResponseType.Interrupt]: IInterruptResponse;
    [ServerResponseType.Restart]: IRestartResponse;
    [ServerResponseType.Exception]: IExceptionResponse;
}

export interface ICatchupRequest {
    since: number;
}
