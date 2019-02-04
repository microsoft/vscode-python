// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ICell, InterruptResult } from '../../types';


export enum ServerResponseType {
    Execute,
    ExecuteObservable,
    Interrupt,
    Restart,
    Exception
}

export interface ServerResponse {
    type: ServerResponseType;
}


export class ExecuteResponse implements ServerResponse {
    type: ServerResponseType = ServerResponseType.Execute;
    cells: ICell[] ;
}

export class ExecuteObservableResponse implements ServerResponse {
    type: ServerResponseType = ServerResponseType.ExecuteObservable;
    id: string; // Unique id so guest side can tell what observable it belongs with
    cells: ICell[];
}

export class InterruptResponse implements ServerResponse {
    type: ServerResponseType = ServerResponseType.Interrupt;
    result: InterruptResult;
}

export class RestartResponse implements ServerResponse {
    type: ServerResponseType = ServerResponseType.Restart;
}

export class ExceptionResponse implements ServerResponse {
    type: ServerResponseType = ServerResponseType.Exception;
    message: string;
}
