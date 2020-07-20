// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import { CellOutputKind, NotebookOutputRenderer as VSCNotebookOutputRenderer, Uri } from 'vscode';
import { NotebookRenderRequest } from 'vscode-proposed';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { JupyterNotebookRenderer } from './constants';

@injectable()
export class NotebookOutputRenderer implements VSCNotebookOutputRenderer {
    public readonly preloads: Uri[] = [];
    constructor() {
        const renderersFolder = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'renderers');
        this.preloads = [Uri.file(path.join(renderersFolder, 'renderers.js'))];
    }

    // @ts-ignore
    public render(document: NotebookDocument, request: NotebookRenderRequest) {
        let outputToSend = request.output;
        if (request.output.outputKind === CellOutputKind.Rich && request.mimeType in request.output.data) {
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
            outputToSend = {
                ...request.output,
                // Send only what we need & ignore other mimeTypes.
                data: {
                    [request.mimeType]: request.output.data[request.mimeType]
                },
                metadata
            };
        }
        return `
            <script data-renderer="${JupyterNotebookRenderer}" data-mime-type="${
            request.mimeType
        }" type="application/json">
                ${JSON.stringify(outputToSend)}
            </script>
            `;
    }
}
