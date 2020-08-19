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
import { createDeferred, Deferred } from '../../../client/common/utils/async';
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
const outputDisposables = new Map<string, { dispose(): void }>();
const outputDisposables2 = new WeakMap<HTMLElement, { dispose(): void }>();
notebookApi?.onWillDestroyOutput((e) => {
    if (e?.outputId && outputDisposables.has(e.outputId)) {
        outputDisposables.get(e.outputId)?.dispose(); // NOSONAR
        outputDisposables.delete(e.outputId);
    }
});

notebookApi?.onDidCreateOutput(({ element, outputId }) => renderOutput(outputId, element.querySelector('script')!));
// notebookApi.onDidReceiveMessage((msg) => {
//     // tslint:disable-next-line: no-console
//     console.error(`Message from renderer`, msg);
// });
// window.addEventListener('message', (e) => {
//     // tslint:disable-next-line: no-console
//     // console.error(`Message from backend`, e.data);
//     if (e.data && e.data.type === 'fromKernel') {
//         postToKernel('HelloKernel', 'WorldKernel');
//     }
// });
const renderedWidgets = new Set<string>();
/**
 * Called from renderer to render output.
 * This will be exposed as a public method on window for renderer to render output.
 */
function renderOutput(outputId: string, tag: HTMLScriptElement) {
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
        // tslint:disable-next-line: no-any
        const model = output['application/vnd.jupyter.widget-view+json'] as any;
        if (!model) {
            // tslint:disable-next-line: no-console
            return console.error('Nothing to render');
        }
        // tslint:disable: no-console
        renderIPyWidget(outputId, model, container);
    } catch (ex) {
        // tslint:disable-next-line: no-console
        console.error(`Failed to render ipywidget type ${mimeType}`, ex);
    }

    // postToRendererExtension('Hello', 'World');
    // postToKernel('HelloKernel', 'WorldKernel');
}
function renderIPyWidget(
    outputId: string,
    model: nbformat.IMimeBundle & { model_id: string; version_major: number },
    container: HTMLElement
) {
    // tslint:disable: no-console
    console.error('Got Something to render');
    if (renderedWidgets.has(model.model_id)) {
        return console.error('already rendering');
    }
    renderedWidgets.add(model.model_id);
    createWidgetView(model, container)
        .then((w) => {
            const disposable = {
                dispose: () => {
                    renderedWidgets.delete(model.model_id);
                    w?.dispose();
                }
            };
            outputDisposables.set(outputId, disposable);
            outputDisposables2.set(container, disposable);
        })
        .catch((ex) => console.error('Failed to render', ex));
}
function destroyIPyWidget(ele: HTMLElement) {
    if (!outputDisposables2.has(ele)) {
        return;
    }
    outputDisposables2.get(ele)!.dispose();
    outputDisposables2.delete(ele);
}
// tslint:disable: no-any
(window as any).renderIPyWidget = renderIPyWidget;
// tslint:disable: no-any
(window as any).destroyIPyWidget = destroyIPyWidget;
// /**
//  * Possible the pre-render scripts load late, after we have attempted to render output from notebook.
//  * At this point look through all such scripts and render the output.
//  */
// function renderOnLoad() {
//     document
//         .querySelectorAll<HTMLScriptElement>('script[type="application/vscode-jupyter-ipywidget+json"]')
//         .forEach(renderOutput);
// }

// tslint:disable-next-line: no-any
// function postToRendererExtension(type: string, payload: any) {
//     notebookApi.postMessage({ type, payload });
// }
// tslint:disable-next-line: no-any
function postToKernel(type: string, payload?: any) {
    vscApi.postMessage({ type, payload });
}

// tslint:disable-next-line: no-any
function initialize() {
    // Possible this (pre-render script loaded after notebook attempted to render something).
    // At this point we need to go and render the existing output.
    initWidgets();
    // renderOnLoad();
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
    private readonly scripts = new Map<string, Deferred<WidgetScriptSource>>();
    constructor() {
        try {
            // For testing, we might use a  browser to load  the stuff.
            // In such instances the `acquireVSCodeApi` will return the event handler to get messages from extension.
            // See ./src/datascience-ui/native-editor/index.html
            // tslint:disable-next-line: no-any
            const api = (vscApi as any) as { handleMessage?: Function };
            if (api.handleMessage) {
                api.handleMessage(this.onMessage.bind(this));
            }
        } catch {
            // Ignore.
        }

        window.addEventListener('message', this.onMessage.bind(this));
        // postToKernel('__IPYWIDGET_KERNEL_MESSAGE', { message: IPyWidgetMessages.IPyWidgets_Ready });
    }
    private onMessage(e: MessageEvent) {
        // tslint:disable
        const type: string | undefined = e.data.type ?? e.data.message;
        if (e.data && type) {
            // tslint:disable-next-line: no-console
            // console.error('processing messages', e.data);
            // tslint:disable-next-line: no-console
            const payload = e.data.payload;
            if (type === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceResponse) {
                // console.error('Got Script source', payload);
                const source: WidgetScriptSource | undefined = payload;
                if (source && this.scripts.has(source.moduleName)) {
                    // console.error('Got Script source and module', payload);
                    this.scripts.get(source.moduleName)?.resolve(source); // NOSONAR
                } else {
                    console.error('Got Script source and module not found', source?.moduleName);
                }
                return;
            } else if (type && type.toUpperCase().startsWith('IPYWIDGET')) {
                // tslint:disable-next-line: no-console
                // console.error(`Message from real backend kernel`, payload);
                this._gotMessage.fire({ type, message: type, payload });
            } else if (type === '__IPYWIDGET_BACKEND_READY') {
                this.backendReady.resolve();
                // } else {
                //     console.error(`No idea what this data is`, e.data);
            }
        }
    }
    // tslint:disable-next-line: no-any
    public postKernelMessage(message: any, payload: any): void {
        this.backendReady.promise.then(() => postToKernel(message, payload)).catch(noop);
    }
    public async getWidgetScriptSource(options: {
        moduleName: string;
        moduleVersion: string;
    }): Promise<WidgetScriptSource> {
        const deferred = createDeferred<WidgetScriptSource>();
        this.scripts.set(options.moduleName, deferred);
        // Whether we have the scripts or not, send message to extension.
        // Useful telemetry and also we know it was explicity requested by ipywidgets.
        this.postKernelMessage(IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest, options);

        return deferred.promise;
    }
    public onReady(): void {
        postToKernel(IPyWidgetMessages.IPyWidgets_Ready);
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
