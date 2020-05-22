// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { CellOutput, CellOutputKind, NotebookOutputRenderer as VSCNotebookOutputRenderer, Uri } from 'vscode';

@injectable()
export class NotebookOutputRenderer implements VSCNotebookOutputRenderer {
    private _preloads: Uri[] = [];

    get preloads(): Uri[] {
        return this._preloads;
    }

    constructor() {
        this._preloads.push(Uri.file('/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/wow.js'));
        this._preloads.push(
            Uri.file(
                '/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/out/datascience-ui/notebook/renderers.js'
            )
        );
    }

    // @ts-ignore
    public render(document: NotebookDocument, output: CellOutput, mimeType: string): string {
        let outputToSend = output;
        // Send only what we need.
        if (output.outputKind === CellOutputKind.Rich && mimeType in output.data) {
            outputToSend = {
                ...output,
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
                if (window['vscode-jupyter']){
                    const tag = document.getElementById("${id}");
                    window['vscode-jupyter']['renderOutput'](tag, '${mimeType}', JSON.parse(tag.innerHTML));
                }
            </script>
            `;
    }
}
