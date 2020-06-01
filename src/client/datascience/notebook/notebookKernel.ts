// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, Uri } from 'vscode';
import type { NotebookCell, NotebookDocument, NotebookKernel as VSCNotebookKernel } from 'vscode-proposed';
import { INotebookExecutionService } from './types';

/**
 * VSC will use this class to execute cells in a notebook.
 * This is where we hookup Jupyter with a Notebook in VSCode.
 */
@injectable()
export class NotebookKernel implements VSCNotebookKernel {
    private _preloads: Uri[] = [];

    get preloads(): Uri[] {
        return this._preloads;
    }
    constructor(@inject(INotebookExecutionService) private readonly execution: INotebookExecutionService) {}
    public get label(): string {
        return 'Jupyter';
    }

    public async executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void> {
        return this.execution.executeCell(document, cell, token);
    }
    public async executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void> {
        return this.execution.executeAllCells(document, token);
    }
}
