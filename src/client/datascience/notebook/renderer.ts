// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CellOutput, CellOutputKind, NotebookOutputRenderer as VSCNotebookOutputRenderer, Uri } from 'vscode';
import { EXTENSION_ROOT_DIR } from '../../constants';

@injectable()
export class NotebookOutputRenderer implements VSCNotebookOutputRenderer {
    get preloads(): Uri[] {
        return this._preloads;
    }
    private _preloads: Uri[] = [];
    constructor() {
        const dataScienceUIFolder = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui');
        this._preloads.push(Uri.file(path.join(dataScienceUIFolder, 'renderers', 'pvscDummy.js')));
        this._preloads.push(Uri.file(path.join(dataScienceUIFolder, 'renderers', 'main.js')));
        this._preloads.push(Uri.file(path.join(dataScienceUIFolder, 'notebook', 'renderers.js')));
    }

    // @ts-ignore
    public render(document: NotebookDocument, output: CellOutput, mimeType: string) {
        let outputToSend = output;
        if (output.outputKind === CellOutputKind.Rich && mimeType in output.data) {
            outputToSend = {
                ...output,
                // Send only what we need & ignore other mimetypes.
                data: {
                    [mimeType]: output.data[mimeType]
                }
            };
        }
        const id = uuid();
        return `
            <script id="${id}" data-mimeType="${mimeType}" type="application/vscode-jupyter+json">
                ${JSON.stringify(outputToSend)}
            </script>
            <script type="text/javascript">
                // Possible pre-render script has not yet loaded.
                debugger;
                if (window['vscode-jupyter']){
                    try {
                        const tag = document.getElementById("${id}");
                        window['vscode-jupyter']['renderOutput'](tag);
                    } catch (ex){
                        console.error("Failed to render ${mimeType}", ex);
                    }
                }
            </script>
            `;
    }
}
