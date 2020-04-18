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

/**
 * Name value pair of widget name/module along with the Uri to the script.
 */
export type WidgetScriptSource = {
    moduleName: string;
    /**
     * Where is the script being source from.
     */
    source?: 'cdn' | 'local' | 'remote';
    /**
     * Resource Uri (not using Uri type as this needs to be sent from extension to UI).
     */
    scriptUri?: string;
};

/**
 * Used to get an entry for widget (or all of them).
 */
export interface IWidgetScriptSourceProvider extends IDisposable {
    /**
     * Return the script path for the requested module.
     * This is called when ipywidgets needs a source for a particular widget.
     */
    getWidgetScriptSource(moduleName: string, moduleVersion: string): Promise<Readonly<WidgetScriptSource>>;
}
