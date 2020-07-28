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
import '../../../client/common/extensions';
import { JupyterIPyWidgetNotebookRenderer } from '../constants';

const notebookApi = acquireNotebookRendererApi(JupyterIPyWidgetNotebookRenderer);
const vscApi = acquireVsCodeApi();

notebookApi.onDidCreateOutput(({ element }) => renderOutput(element.querySelector('script')!));
notebookApi.onDidReceiveMessage((msg) => {
    // tslint:disable-next-line: no-console
    console.error(`Message from renderer`, msg);
});
window.addEventListener('message', (e) => {
    // tslint:disable-next-line: no-console
    console.error(`Message from kernel`, e.data);
    if (e.data && e.data.type === 'fromKernel') {
        postToKernel('HelloKernel', 'WorldKernel');
    }
});
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
function postToKernel(type: string, payload: any) {
    vscApi.postMessage({ type, payload });
}

// tslint:disable-next-line: no-any
function initialize() {
    // Possible this (pre-render script loaded after notebook attempted to render something).
    // At this point we need to go and render the existing output.
    renderOnLoad();
}

// tslint:disable-next-line: no-console
console.log('Pre-Render ipywidget scripts loaded');
initialize();
