// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// This must be on top, do not change. Required by webpack.
declare let __webpack_public_path__: string;
const getPublicPath = () => {
    const currentDirname = (document.currentScript as HTMLScriptElement).src.replace(/[^/]+$/, '');
    return new URL(currentDirname).toString();
};

__webpack_public_path__ = getPublicPath();
// This must be on top, do not change. Required by webpack.

import type { nbformat } from '@jupyterlab/coreutils';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createDeferred } from '../../../client/common/utils/async';
import { noop } from '../../../client/common/utils/misc';
import { IPyWidgetMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { WidgetScriptSource } from '../../../client/datascience/ipywidgets/types';
import { JupyterIPyWidgetNotebookRenderer } from '../constants';
import { WidgetManagerComponent } from './container';
import { createEmitter } from './events';
import { WidgetManager } from './manager';
import { Event, IPyWidgetsPostOffice, IPyWidgetsSettings } from './types';

const notebookApi = acquireNotebookRendererApi(JupyterIPyWidgetNotebookRenderer);
const vscApi = acquireVsCodeApi();

notebookApi.onDidCreateOutput(({ element }) => renderOutput(element.querySelector('script')!));
notebookApi.onDidReceiveMessage((msg) => {
    // tslint:disable-next-line: no-console
    console.error(`Message from renderer`, msg);
});
window.addEventListener('message', (e) => {
    // tslint:disable-next-line: no-console
    console.error(`Message from backend`, e.data);
    if (e.data && e.data.type === 'fromKernel') {
        postToKernel('HelloKernel', 'WorldKernel');
    }
});
const renderedWidgets = new Set<string>();
/**
 * Called from renderer to render output.
 * This will be exposed as a public method on window for renderer to render output.
 */
function renderOutput(tag: HTMLScriptElement) {
    let container: HTMLElement;
    const mimeType = tag.dataset.mimeType as string;
    try {
        const output = JSON.parse(tag.innerHTML) as nbformat.IExecuteResult | nbformat.IDisplayData;
        // tslint:disable-next-line: no-console
        console.log(`Rendering ipywidget ${mimeType}`, output);

        // Create an element to render in, or reuse a previous element.
        const maybeOldContainer = tag.previousElementSibling;
        if (maybeOldContainer instanceof HTMLDivElement && maybeOldContainer.dataset.renderer) {
            container = maybeOldContainer;
            // tslint:disable-next-line: no-inner-html
            container.innerHTML = '';
        } else {
            container = document.createElement('div');
            tag.parentNode?.insertBefore(container, tag.nextSibling);
        }
        const model = output['application/vnd.jupyter.widget-view+json'] as any;
        if (!model) {
            // tslint:disable-next-line: no-console
            return console.error('Nothing to render');
        }
        // tslint:disable: no-console
        console.error('Got Something to render');
        if (renderedWidgets.has(model.model_id)) {
            return console.error('already rendering');
        }
        renderedWidgets.add(model.model_id);
        createWidgetView(model, container).catch((ex) => console.error('Failed to render', ex));
    } catch (ex) {
        // tslint:disable-next-line: no-console
        console.error(`Failed to render ipywidget type ${mimeType}`, ex);
    }

    postToRendererExtension('Hello', 'World');
    postToKernel('HelloKernel', 'WorldKernel');
}

/**
 * Possible the pre-render scripts load late, after we have attempted to render output from notebook.
 * At this point look through all such scripts and render the output.
 */
function renderOnLoad() {
    document
        .querySelectorAll<HTMLScriptElement>('script[type="application/vscode-jupyter-ipywidget+json"]')
        .forEach(renderOutput);
}

// tslint:disable-next-line: no-any
function postToRendererExtension(type: string, payload: any) {
    notebookApi.postMessage({ type, payload });
}
// tslint:disable-next-line: no-any
function postToKernel(type: string, payload?: any) {
    vscApi.postMessage({ type, payload });
}

// tslint:disable-next-line: no-any
function initialize() {
    // Possible this (pre-render script loaded after notebook attempted to render something).
    // At this point we need to go and render the existing output.
    initWidgets();
    renderOnLoad();
}

class MyPostOffice implements IPyWidgetsPostOffice {
    public get settings(): IPyWidgetsSettings | undefined {
        return { timeoutWaitingForWidgetsToLoad: 5_000 };
    }
    // tslint:disable-next-line: no-any
    public get onDidReceiveKernelMessage(): Event<any> {
        return this._gotMessage.event;
    }
    private readonly _gotMessage = createEmitter();
    private readonly backendReady = createDeferred();
    constructor() {
        window.addEventListener('message', (e) => {
            // tslint:disable-next-line: no-console
            console.error('processing messages');
            // tslint:disable-next-line: no-console
            if (e.data && e.data.type === '__IPYWIDGET_KERNEL_MESSAGE') {
                // tslint:disable-next-line: no-console
                const payload = e.data.payload;
                if ('message' in payload && !('type' in payload)) {
                    payload.type = payload.message; // Inconsistency in messages sent, we send using `message` but use `type` at receiving end.
                }
                // tslint:disable-next-line: no-console
                console.error(`Message from real backend kernel`, payload);
                this._gotMessage.fire(e.data.payload);
            }
            if (e.data && e.data.type === '__IPYWIDGET_BACKEND_READY') {
                this.backendReady.resolve();
            }
        });
        // postToKernel('__IPYWIDGET_KERNEL_MESSAGE', { message: IPyWidgetMessages.IPyWidgets_Ready });
    }
    // tslint:disable-next-line: no-any
    public postKernelMessage(message: any, payload: any): void {
        this.backendReady.promise
            .then(() => postToKernel('__IPYWIDGET_KERNEL_MESSAGE', { message, payload }))
            .catch(noop);
    }
    public async getWidgetScriptSource(_options: {
        moduleName: string;
        moduleVersion: string;
    }): Promise<WidgetScriptSource> {
        throw new Error('Method not implemented.');
    }
    public onReady(): void {
        postToKernel('__IPYWIDGET_KERNEL_MESSAGE', { message: IPyWidgetMessages.IPyWidgets_Ready });
        postToKernel('READY');
    }
}

let widgetManagerPromise: Promise<WidgetManager> | undefined;
async function getWidgetManager(): Promise<WidgetManager> {
    if (!widgetManagerPromise) {
        widgetManagerPromise = new Promise((resolve) => WidgetManager.instance.subscribe(resolve));
        widgetManagerPromise!
            .then((wm) => {
                if (wm) {
                    const oldDispose = wm.dispose.bind(wm);
                    wm.dispose = () => {
                        // this.renderedViews.clear();
                        // this.widgetManager = undefined;
                        widgetManagerPromise = undefined;
                        return oldDispose();
                    };
                }
            })
            .catch(noop);
    }
    return widgetManagerPromise;
}

async function createWidgetView(
    widgetData: nbformat.IMimeBundle & { model_id: string; version_major: number },
    element: HTMLElement
) {
    const wm = await getWidgetManager();
    try {
        return await wm?.renderWidget(widgetData, element);
    } catch (ex) {
        // tslint:disable-next-line: no-console
        console.error('Failed to render widget', ex);
    }
}

function initWidgets() {
    // tslint:disable-next-line: no-console
    console.error('Rendering widget container');
    try {
        const postOffice: IPyWidgetsPostOffice = new MyPostOffice();
        const container = document.createElement('div');
        document.body.appendChild(container);
        ReactDOM.render(
            React.createElement(WidgetManagerComponent, { postOffice, widgetContainerElement: container }, null),
            container
        );
    } catch (ex) {
        // tslint:disable-next-line: no-console
        console.error('Ooops', ex);
    }
}

// tslint:disable-next-line: no-console
console.log('Pre-Render ipywidget scripts loaded');
initialize();
