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
import '../../client/common/extensions';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { handleLinkClick } from '../interactive-common/handlers';
import { JupyterNotebookRenderer } from './constants';
import { CellOutput } from './render';

const notebookApi = acquireNotebookRendererApi(JupyterNotebookRenderer);

notebookApi.onDidCreateOutput(({ element }) => renderOutput(element.querySelector('script')!));

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
        console.log(`Rendering mimeType ${mimeType}`, output);

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

        ReactDOM.render(React.createElement(CellOutput, { mimeType, output }, null), container);
    } catch (ex) {
        // tslint:disable-next-line: no-console
        console.error(`Failed to render mime type ${mimeType}`, ex);
    }
}

/**
 * Possible the pre-render scripts load late, after we have attempted to render output from notebook.
 * At this point look through all such scripts and render the output.
 */
function renderOnLoad() {
    document
        .querySelectorAll<HTMLScriptElement>('script[type="application/vscode-jupyter+json"]')
        .forEach(renderOutput);
}

// tslint:disable-next-line: no-any
function postToExtension(type: string, payload: any) {
    notebookApi.postMessage({ type, payload });
}
function linkHandler(href: string) {
    if (href.startsWith('data:image/png')) {
        postToExtension(InteractiveWindowMessages.SavePng, href);
    } else {
        postToExtension(InteractiveWindowMessages.OpenLink, href);
    }
}

// tslint:disable-next-line: no-any
function initialize() {
    document.addEventListener('click', (e) => handleLinkClick(e, linkHandler), true);
    // Possible this (pre-render script loaded after notebook attempted to render something).
    // At this point we need to go and render the existing output.
    renderOnLoad();
}

// tslint:disable-next-line: no-console
console.log('Pre-Render scripts loaded');
initialize();
