// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as vsls from 'vsls/vscode';

import { IAsyncDisposable } from '../../../common/types';
import { ICell } from '../../types';

// tslint:disable:max-classes-per-file

export enum ServerResponseType {
    ExecuteObservable,
    Exception,
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

export interface IExceptionResponse extends IServerResponse {
    message: string;
}

// Map all responses to their properties
export interface IResponseMapping {
    [ServerResponseType.ExecuteObservable]: IExecuteObservableResponse;
    [ServerResponseType.Exception]: IExceptionResponse;
}

export interface ICatchupRequest {
    since: number;
}

export interface ILiveShareHasRole {
    readonly role: vsls.Role;
}

export interface ILiveShareParticipant extends IAsyncDisposable, ILiveShareHasRole {
    onSessionChange(api: vsls.LiveShare | null): Promise<void>;
    onAttach(api: vsls.LiveShare | null): Promise<void>;
    onDetach(api: vsls.LiveShare | null): Promise<void>;
    onPeerChange(ev: vsls.PeersChangeEvent): Promise<void>;
    waitForServiceName(): Promise<string>;
}
