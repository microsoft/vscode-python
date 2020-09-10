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
import type { NotebookOutputEventParams } from 'vscode-notebook-renderer';
import '../../client/common/extensions';
import { JupyterNotebookRenderer } from './constants';
import { CellOutput } from './render';

const notebookApi = acquireNotebookRendererApi(JupyterNotebookRenderer);

notebookApi.onDidCreateOutput(renderOutput);

/**
 * Called from renderer to render output.
 * This will be exposed as a public method on window for renderer to render output.
 */
function renderOutput(request: NotebookOutputEventParams) {
    try {
        // tslint:disable-next-line: no-console
        console.error('request', request);
        const output = convertVSCodeOutputToExecutResultOrDisplayData(request);
        // tslint:disable-next-line: no-console
        console.log(`Rendering mimeType ${request.mimeType}`, output);
        // tslint:disable-next-line: no-console
        console.error('request output', output);

        ReactDOM.render(React.createElement(CellOutput, { mimeType: request.mimeType, output }, null), request.element);
    } catch (ex) {
        // tslint:disable-next-line: no-console
        console.error(`Failed to render mime type ${request.mimeType}`, ex);
    }
}

function convertVSCodeOutputToExecutResultOrDisplayData(
    request: NotebookOutputEventParams
): nbformat.IExecuteResult | nbformat.IDisplayData {
    // tslint:disable-next-line: no-any
    const metadata: Record<string, any> = {};
    // Send metadata only for the mimeType we are interested in.
    const customMetadata = request.output.metadata?.custom;
    if (customMetadata) {
        if (customMetadata[request.mimeType]) {
            metadata[request.mimeType] = customMetadata[request.mimeType];
        }
        if (customMetadata.needs_background) {
            metadata.needs_background = customMetadata.needs_background;
        }
        if (customMetadata.unconfined) {
            metadata.unconfined = customMetadata.unconfined;
        }
    }

    return {
        data: {
            [request.mimeType]: request.output.data[request.mimeType]
        },
        metadata,
        execution_count: null,
        output_type: request.output.metadata?.custom?.vscode?.outputType || 'execute_result'
    };
}
