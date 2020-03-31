// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Event } from 'vscode';
import { IDisposable } from '../../common/types';
import { IPyWidgetMessages } from '../interactive-common/interactiveWindowTypes';

export interface IPyWidgetMessage {
    message: IPyWidgetMessages;
    // tslint:disable-next-line: no-any
    payload: any;
}

/**
 * Used to send/receive messages related to IPyWidgets
 */
export interface IIPyWidgetMessageDispatcher extends IDisposable {
    // tslint:disable-next-line: no-any
    postMessage: Event<IPyWidgetMessage>;
    // tslint:disable-next-line: no-any
    receiveMessage(message: IPyWidgetMessage): void;
    initialize(): Promise<void>;
}
