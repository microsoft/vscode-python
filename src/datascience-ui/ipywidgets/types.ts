// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as jupyterlab from '@jupyter-widgets/base/lib';
import type { Kernel, KernelMessage } from '@jupyterlab/services';
import type { nbformat } from '@jupyterlab/services/node_modules/@jupyterlab/coreutils';
import { Widget } from '@phosphor/widgets';
import { IInteractiveWindowMapping } from '../../client/datascience/interactive-common/interactiveWindowTypes';

export interface IMessageSender {
    sendMessage<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]): void;
}

export type CommTargetCallback = (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>;

export type IJupyterLabWidgetManagerCtor = new (
    kernel: Kernel.IKernelConnection,
    el: HTMLElement,
    // tslint:disable-next-line: no-any
    loadErrorHandler: (className: string, moduleName: string, moduleVersion: string, error: any) => void
) => IJupyterLabWidgetManager;

export interface IJupyterLabWidgetManager {
    dispose(): void;
    /**
     * Close all widgets and empty the widget state.
     * @return Promise that resolves when the widget state is cleared.
     */
    clear_state(): Promise<void>;
    /**
     * Get a promise for a model by model id.
     *
     * #### Notes
     * If a model is not found, undefined is returned (NOT a promise). However,
     * the calling code should also deal with the case where a rejected promise
     * is returned, and should treat that also as a model not found.
     */
    get_model(model_id: string): Promise<jupyterlab.DOMWidgetModel> | undefined;
    /**
     * Display a DOMWidget view.
     *
     */
    // tslint:disable-next-line: no-any
    display_view(msg: any, view: Backbone.View<Backbone.Model>, options: any): Promise<Widget>;
    /**
     * Creates a promise for a view of a given model
     *
     * Make sure the view creation is not out of order with
     * any state updates.
     */
    // tslint:disable-next-line: no-any
    create_view(model: jupyterlab.DOMWidgetModel, options: any): Promise<jupyterlab.DOMWidgetView>;
}

// export interface IIPyWidgetManager extends IMessageHandler {
export interface IIPyWidgetManager {
    dispose(): void;
    /**
     * Clears/removes all the widgets
     *
     * @memberof IIPyWidgetManager
     */
    clear(): Promise<void>;
    /**
     * Displays a widget for the mesasge with header.msg_type === 'display_data'.
     * The widget is rendered in a given HTML element.
     * Returns a disposable that can be used to dispose/remove the rendered Widget.
     * The message must
     *
     * @param {KernelMessage.IIOPubMessage} msg
     * @param {HTMLElement} ele
     * @returns {Promise<{ dispose: Function }>}
     * @memberof IIPyWidgetManager
     */
    renderWidget(data: nbformat.IMimeBundle, ele: HTMLElement): Promise<{ dispose: Function }>;
}
