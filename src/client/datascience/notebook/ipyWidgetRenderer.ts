// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { NotebookOutputRenderer as VSCNotebookOutputRenderer, Uri } from 'vscode';
import { NotebookRenderRequest } from 'vscode-proposed';
import { NotebookCommunication, NotebookDocument } from '../../../../typings/vscode-proposed';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { JupyterIPyWidgetNotebookRenderer } from './constants';

@injectable()
export class IPyWidgetNotebookOutputRenderer implements VSCNotebookOutputRenderer {
    public readonly preloads: Uri[] = [];
    constructor() {
        this.preloads = [
            Uri.file(path.join(EXTENSION_ROOT_DIR, 'out', 'ipywidgets', 'dist', 'ipywidgets.js')),
            Uri.file(path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'renderers', 'ipywidgets.js'))
        ];
    }

    public resolveNotebook(document: NotebookDocument, communication: NotebookCommunication) {
        communication.postMessage({ type: 'FromRenderer', payload: `MY_DATA${document.uri.fsPath}` });
        communication.onDidReceiveMessage((msg) => {
            // tslint:disable-next-line: no-console
            console.error('Message from UI', msg);
        });
    }
    // @ts-ignore
    public render(document: NotebookDocument, request: NotebookRenderRequest) {
        const outputToSend = request.output.data;
        return `
            <script data-renderer="${JupyterIPyWidgetNotebookRenderer}" data-mime-type="${
            request.mimeType
        }" type="application/json">
                ${JSON.stringify(outputToSend)}
            </script>
            `;
    }
}
