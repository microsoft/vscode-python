// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import '@jupyter-widgets/controls/css/labvariables.css';

import type { Kernel, KernelMessage } from '@jupyterlab/services';
import type { nbformat } from '@jupyterlab/services/node_modules/@jupyterlab/coreutils';
import { Widget } from '@phosphor/widgets';
import * as fastDeepEqual from 'fast-deep-equal';
import 'rxjs/add/operator/concatMap';
import { Observable } from 'rxjs/Observable';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import {
    IInteractiveWindowMapping,
    IPyWidgetMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { KernelSocketOptions } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { create as createKernel } from './kernel';
import { IIPyWidgetManager, IJupyterLabWidgetManager, IJupyterLabWidgetManagerCtor } from './types';

// tslint:disable: no-any

export class WidgetManager implements IIPyWidgetManager, IMessageHandler {
    public static get instance(): Observable<WidgetManager | undefined> {
        return WidgetManager._instance;
    }
    private static _instance = new ReplaySubject<WidgetManager | undefined>();
    private manager?: IJupyterLabWidgetManager;
    private proxyKernel?: Kernel.IKernel;
    private options?: KernelSocketOptions;
    private pendingMessages: { message: string; payload: any }[] = [];
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
        private readonly postOffice: PostOffice,
        private readonly scriptLoader: {
            loadWidgetScriptsFromThirdPartySource: boolean;
            // tslint:disable-next-line: no-any
            errorHandler(className: string, moduleName: string, moduleVersion: string, error: any): void;
        }
    ) {
        // tslint:disable-next-line: no-any
        this.postOffice.addHandler(this);

        // Handshake.
        this.postOffice.sendMessage<IInteractiveWindowMapping>(IPyWidgetMessages.IPyWidgets_Ready);
    }
    public dispose(): void {
        this.proxyKernel?.dispose(); // NOSONAR
        this.postOffice.removeHandler(this);
        this.clear().ignoreErrors();
    }
    public async clear(): Promise<void> {
        await this.manager?.clear_state();
    }
    public handleMessage(message: string, payload?: any) {
        if (message === IPyWidgetMessages.IPyWidgets_kernelOptions) {
            this.initializeKernelAndWidgetManager(payload);
        } else if (message === IPyWidgetMessages.IPyWidgets_onRestartKernel) {
            // Kernel was restarted.
            this.manager?.dispose(); // NOSONAR
            this.manager = undefined;
            this.proxyKernel?.dispose(); // NOSONAR
            this.proxyKernel = undefined;
            WidgetManager._instance.next(undefined);
        } else if (!this.proxyKernel) {
            this.pendingMessages.push({ message, payload });
        }
        return true;
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
    ): Promise<Widget | undefined> {
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
            return undefined;
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
            return undefined;
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
    private initializeKernelAndWidgetManager(options: KernelSocketOptions) {
        if (this.proxyKernel && fastDeepEqual(options, this.options)) {
            return;
        }
        this.proxyKernel?.dispose(); // NOSONAR
        this.proxyKernel = createKernel(options, this.postOffice, this.pendingMessages);
        this.pendingMessages = [];

        // Dispose any existing managers.
        this.manager?.dispose(); // NOSONAR
        try {
            // The JupyterLabWidgetManager will be exposed in the global variable `window.ipywidgets.main` (check webpack config - src/ipywidgets/webpack.config.js).
            // tslint:disable-next-line: no-any
            const JupyterLabWidgetManager = (window as any).vscIPyWidgets.WidgetManager as IJupyterLabWidgetManagerCtor;
            if (!JupyterLabWidgetManager) {
                throw new Error('JupyterLabWidgetManadger not defined. Please include/check ipywidgets.js file');
            }
            // Create the real manager and point it at our proxy kernel.
            this.manager = new JupyterLabWidgetManager(this.proxyKernel, this.widgetContainer, this.scriptLoader);

            // Listen for display data messages so we can prime the model for a display data
            this.proxyKernel.iopubMessage.connect(this.handleDisplayDataMessage.bind(this));

            // Tell the observable about our new manager
            WidgetManager._instance.next(this);
        } catch (ex) {
            // tslint:disable-next-line: no-console
            console.error('Failed to initialize WidgetManager', ex);
        }
    }
    /**
     * Ensure we create the model for the display data.
     */
    private handleDisplayDataMessage(_sender: any, payload: KernelMessage.IIOPubMessage) {
        // tslint:disable-next-line:no-require-imports
        const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services'); // NOSONAR

        if (!jupyterLab.KernelMessage.isDisplayDataMsg(payload)) {
            return;
        }
        const displayMsg = payload as KernelMessage.IDisplayDataMsg;

        if (
            displayMsg.content &&
            displayMsg.content.data &&
            displayMsg.content.data['application/vnd.jupyter.widget-view+json']
        ) {
            // tslint:disable-next-line: no-any
            const data = displayMsg.content.data['application/vnd.jupyter.widget-view+json'] as any;
            const modelId = data.model_id;
            let deferred = this.modelIdsToBeDisplayed.get(modelId);
            if (!deferred) {
                deferred = createDeferred();
                this.modelIdsToBeDisplayed.set(modelId, deferred);
            }
            if (!this.manager) {
                throw new Error('DS IPyWidgetManager not initialized');
            }
            const modelPromise = this.manager.get_model(data.model_id);
            if (modelPromise) {
                modelPromise.then((_m) => deferred?.resolve()).catch((e) => deferred?.reject(e));
            } else {
                deferred.resolve();
            }
        }
    }
}
