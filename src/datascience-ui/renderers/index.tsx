// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

console.error('Loaded index.tsx00');
// This must be on top, do not change. Required by webpack.
declare let __webpack_public_path__: string;

// tslint:disable-next-line: no-any
if ((window as any).__PVSC_Public_Path) {
    // This variable tells Webpack to this as the root path used to request webpack bundles.
    // tslint:disable-next-line: no-any
    __webpack_public_path__ = (window as any).__PVSC_Public_Path;
}

// This must be on top, do not change. Required by webpack.
console.error('Loaded index.tsx');
import type { nbformat } from '@jupyterlab/coreutils';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import '../../client/common/extensions';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { handleLinkClick } from '../interactive-common/handlers';
import type { IVsCodeApi } from '../react-common/postOffice';
import { CellOutput } from './render';
console.error('Loaded index.tsx2');
export declare function acquireVsCodeApi(): IVsCodeApi;
console.error('Loaded index.tsx3');

/**
 * Called from renderer to render output.
 * This will be exposed as a public method on window for renderer to render output.
 */
function renderOutput(
    tag: HTMLScriptElement,
    mimeType: string,
    output: nbformat.IExecuteResult | nbformat.IDisplayData
) {
    let container: HTMLElement;
    // Create an element to render in, or reuse a previous element.
    if (tag.nextElementSibling instanceof HTMLDivElement) {
        container = tag.nextElementSibling;
        // tslint:disable-next-line: no-inner-html
        container.innerHTML = '';
    } else {
        container = document.createElement('div');
        tag.parentNode?.insertBefore(container, tag.nextSibling); // NOSONAR
    }
    tag.parentElement?.removeChild(tag); // NOSONAR

    ReactDOM.render(React.createElement(CellOutput, { mimeType, output }, null), container);
}

/**
 * Possible the pre-render scripts load late, after we have attempted to render output from notebook.
 * At this point look through all such scripts and render the output.
 */
function renderOnLoad() {
    console.error('Loaded index.tsx6');
    document
        .querySelectorAll<HTMLScriptElement>('script[type="application/vscode-jupyter+json"]')
        .forEach((tag) => renderOutput(tag, tag.dataset.mimeType as string, JSON.parse(tag.innerHTML)));
}

// tslint:disable-next-line: no-any
function postToExtension(type: string, payload: any) {
    acquireVsCodeApi().postMessage({ type, payload }); // NOSONAR
}
function linkHandler(href: string) {
    if (href.startsWith('data:image/png')) {
        postToExtension(InteractiveWindowMessages.SavePng, href);
    } else {
        postToExtension(InteractiveWindowMessages.OpenLink, href);
    }
}

// tslint:disable-next-line: no-any
function initialize(global: Record<string, any>) {
    console.error('Loaded index.tsx5');
    global['vscode-jupyter'] = {};
    global['vscode-jupyter'].renderOutput = renderOutput;
    document.addEventListener('click', (e) => handleLinkClick(e, linkHandler), true);
    renderOnLoad();
}

console.error('Loaded index.tsx4');
// Expose necessary hooks for client renderer to render output.
// tslint:disable-next-line: no-any
(window as any).renderOutput = renderOutput;
initialize(window);
