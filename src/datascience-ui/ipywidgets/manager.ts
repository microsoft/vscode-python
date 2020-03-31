// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '@jupyter-widgets/controls/css/labvariables.css';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { deserialize } from '@jupyterlab/services/lib/kernel/serialize';
import { nbformat } from '@jupyterlab/services/node_modules/@jupyterlab/coreutils';
import * as fastDeepEqual from 'fast-deep-equal';
import 'rxjs/add/operator/concatMap';
import { Observable } from 'rxjs/Observable';
import { IDisposable } from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import {
    IInteractiveWindowMapping,
    IPyWidgetMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { KernelSocketOptions } from '../../client/datascience/types';
import { create as createKernel, IKernelSocket } from './kernelFactory';
import { IIPyWidgetManager, IJupyterLabWidgetManager, IJupyterLabWidgetManagerCtor, IMessageSender } from './types';

export class WidgetManager implements IIPyWidgetManager, IMessageSender {
    public static get instance(): Promise<WidgetManager> {
        return WidgetManager._instance.promise;
    }
    private static _instance = createDeferred<WidgetManager>();
    private manager?: IJupyterLabWidgetManager;
    private proxyKernel?: Kernel.IKernel;
    private options?: KernelSocketOptions;
    private readonly kernelSocket: IKernelSocket;
    /**
     * Contains promises related to model_ids that need to be displayed.
     * When we receive a message from the kernel of type = `display_data` for a widget (`application/vnd.jupyter.widget-view+json`),
     * then its time to display this.
     * We need to keep track of this. A boolean is sufficient, but we're using a promise so we can be notified when it is ready.
     *
     * @private
     * @memberof WidgetManager
     */
    private modelIdsToBeDisplayed = new Map<string, Deferred<void>>();
    constructor(
        private readonly widgetContainer: HTMLElement,
        // tslint:disable-next-line: no-any
        private readonly messages: Observable<{ type: string; payload?: any }>,
        // tslint:disable-next-line: no-any
        private readonly dispatcher: <M extends IInteractiveWindowMapping, T extends keyof M>(
            type: T,
            payload?: M[T]
        ) => void
    ) {
        this.kernelSocket = {
            onMessage: noop,
            postMessage: (data) => {
                console.log('OUTGOING', data);
                if (data.targetName && Object.keys(data).length === 1) {
                    dispatcher(IPyWidgetMessages.IPyWidgets_registerCommTarget, data.targetName);
                } else {
                    dispatcher(IPyWidgetMessages.IPyWidgets_msg, data as any);
                }
            }
        };
        this.registerPostOffice();
        // Handshake.
        dispatcher(IPyWidgetMessages.IPyWidgets_Ready, '');
        // this.proxyKernel = createKernel(this.kernelSocket);
        // try {
        //     // The JupyterLabWidgetManager will be exposed in the global variable `window.ipywidgets.main` (check webpack config - src/ipywidgets/webpack.config.js).
        //     // tslint:disable-next-line: no-any
        //     const JupyterLabWidgetManager = (window as any).vscIPyWidgets.WidgetManager as IJupyterLabWidgetManagerCtor;
        //     if (!JupyterLabWidgetManager) {
        //         throw new Error('JupyterLabWidgetManager not defined. Please include/check ipywidgets.js file');
        //     }
        //     // tslint:disable-next-line: no-any
        //     const kernel = (this.proxyKernel as any) as Kernel.IKernel;
        //     this.manager = new JupyterLabWidgetManager(kernel, widgetContainer);
        //     WidgetManager._instance.resolve(this);
        //     this.registerPostOffice();
        // } catch (ex) {
        //     // tslint:disable-next-line: no-console
        //     console.error('Failed to initialize WidgetManager', ex);
        // }
    }
    public dispose(): void {
        this.proxyKernel?.dispose();
    }
    public async clear(): Promise<void> {
        await this.manager?.clear_state();
    }
    /**
     * Renders a widget and returns a disposable (to remove the widget).
     *
     * @param {(nbformat.IMimeBundle & {model_id: string; version_major: number})} data
     * @param {HTMLElement} ele
     * @returns {Promise<{ dispose: Function }>}
     * @memberof WidgetManager
     */
    public async renderWidget(
        data: nbformat.IMimeBundle & { model_id: string; version_major: number },
        ele: HTMLElement
    ): Promise<IDisposable> {
        if (!data) {
            throw new Error(
                "application/vnd.jupyter.widget-view+json not in msg.content.data, as msg.content.data is 'undefined'."
            );
        }
        if (!this.manager) {
            throw new Error('DS IPyWidgetManager not initialized.');
        }

        if (!data || data.version_major !== 2) {
            console.warn('Widget data not avaialble to render an ipywidget');
            return { dispose: noop };
        }

        const modelId = data.model_id as string;
        // Check if we have processed the data for this model.
        // If not wait.
        if (!this.modelIdsToBeDisplayed.has(modelId)) {
            this.modelIdsToBeDisplayed.set(modelId, createDeferred());
        }
        // Wait until it is flagged as ready to be processed.
        // This widget manager must have recieved this message and performed all operations before this.
        // Once all messages prior to this have been processed in sequence and this message is receievd,
        // then, and only then are we ready to render the widget.
        // I.e. this is a way of synchronzing the render with the processing of the messages.
        await this.modelIdsToBeDisplayed.get(modelId)!.promise;

        const modelPromise = this.manager.get_model(data.model_id);
        if (!modelPromise) {
            console.warn('Widget model not avaialble to render an ipywidget');
            return { dispose: noop };
        }

        // ipywdigets may not have completed creating the model.
        // ipywidgets have a promise, as the model may get created by a 3rd party library.
        // That 3rd party library may not be available and may have to be downloaded.
        // Hence the promise to wait until it has been created.
        const model = await modelPromise;
        const view = await this.manager.create_view(model, { el: ele });
        // tslint:disable-next-line: no-any
        return this.manager.display_view(data, view, { node: ele });
    }
    public sendMessage<M extends IInteractiveWindowMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.dispatcher(type, payload);
    }
    private initializeKernelAndWidgetManager(options: KernelSocketOptions) {
        if (this.proxyKernel && fastDeepEqual(options, this.options)) {
            return;
        }
        this.proxyKernel = createKernel(this.kernelSocket, options);

        // When a comm target has been regisered, we need to register this in the real kernel in extension side.
        // Hence send that message to extension.
        const originalRegisterCommTarget = this.proxyKernel.registerCommTarget.bind(this.proxyKernel);
        this.proxyKernel.registerCommTarget = (
            targetName: string,
            callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>
        ) => {
            this.dispatcher(IPyWidgetMessages.IPyWidgets_registerCommTarget, targetName);
            return originalRegisterCommTarget(targetName, callback);
        };

        this.manager?.dispose();
        try {
            // The JupyterLabWidgetManager will be exposed in the global variable `window.ipywidgets.main` (check webpack config - src/ipywidgets/webpack.config.js).
            // tslint:disable-next-line: no-any
            const JupyterLabWidgetManager = (window as any).vscIPyWidgets.WidgetManager as IJupyterLabWidgetManagerCtor;
            if (!JupyterLabWidgetManager) {
                throw new Error('JupyterLabWidgetManager not defined. Please include/check ipywidgets.js file');
            }
            // tslint:disable-next-line: no-any
            const kernel = (this.proxyKernel as any) as Kernel.IKernel;
            this.manager = new JupyterLabWidgetManager(kernel, this.widgetContainer);
            if (WidgetManager._instance.completed) {
                WidgetManager._instance = createDeferred<WidgetManager>();
            }
            WidgetManager._instance.resolve(this);
        } catch (ex) {
            // tslint:disable-next-line: no-console
            console.error('Failed to initialize WidgetManager', ex);
        }
    }
    private registerPostOffice(): void {
        // Process all messages sequentially.
        this.messages
            .concatMap(async (msg) => {
                try {
                    if (msg.type === IPyWidgetMessages.IPyWidgets_kernelOptions) {
                        this.initializeKernelAndWidgetManager(msg.payload);
                    }
                    if (msg.type === IPyWidgetMessages.IPyWidgets_msg) {
                        // msg.payload = deserialize(msg.payload);
                        if (this.kernelSocket.onMessage) {
                            this.kernelSocket.onMessage(msg.payload);
                        }
                        // await this.handleMessageAsync(msg.type, msg.payload);
                        // tslint:disable-next-line: no-any
                        await this.handleMessageAsync(msg.type, deserialize(msg.payload) as any);
                    }
                    // this.restoreBuffers(msg.payload);
                    // await this.proxyKernel.handleMessageAsync(msg.type, msg.payload);
                } catch (ex) {
                    console.error(ex);
                }
            })
            .subscribe();
        // this.proxyKernel.initialize();
    }
    /**
     * This is the handler for all kernel messages.
     * All messages must be processed sequentially (even when processed asynchronously).
     *
     * @param {string} msg
     * @param {*} [payload]
     * @returns {Promise<void>}
     * @memberof WidgetManager
     */
    // tslint:disable-next-line: no-any
    private async handleMessageAsync(_msg: string, payload: KernelMessage.IIOPubMessage): Promise<void> {
        // if (msg === IPyWidgetMessages.IPyWidgets_display_data_msg) {
        if (KernelMessage.isDisplayDataMsg(payload)) {
            let msgChain = (this.proxyKernel as any)._msgChain as Promise<void>;
            msgChain = msgChain.then(async () => {
                // General IOPub message
                const displayMsg = payload as KernelMessage.IDisplayDataMsg;

                if (
                    displayMsg.content &&
                    displayMsg.content.data &&
                    displayMsg.content.data['application/vnd.jupyter.widget-view+json']
                ) {
                    // tslint:disable-next-line: no-any
                    const data = displayMsg.content.data['application/vnd.jupyter.widget-view+json'] as any;
                    const modelId = data.model_id;

                    if (!this.modelIdsToBeDisplayed.has(modelId)) {
                        this.modelIdsToBeDisplayed.set(modelId, createDeferred());
                    }
                    if (!this.manager) {
                        throw new Error('DS IPyWidgetManager not initialized');
                    }
                    const modelPromise = this.manager.get_model(data.model_id);
                    if (modelPromise) {
                        await modelPromise;
                    }
                    // Mark it as completed (i.e. ready to display).
                    this.modelIdsToBeDisplayed.get(modelId)!.resolve();
                }
            });

            // tslint:disable-next-line: no-any
            (this.proxyKernel as any)._msgChain = msgChain;
        }
    }
}
