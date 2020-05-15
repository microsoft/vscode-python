// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, NotebookCell, NotebookDocument, NotebookKernel as VSCNotebookKernel, Uri } from 'vscode';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { NotebookExecutionProvider } from './executionProvider';

@injectable()
export class NotebookKernel implements VSCNotebookKernel {
    private _preloads: Uri[] = [];

    get preloads(): Uri[] {
        return this._preloads;
    }
    constructor(
        @inject(NotebookExecutionProvider) private readonly executionProvider: NotebookExecutionProvider,
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider
    ) {}
    public get label(): string {
        return 'Jupyter';
    }
    public async executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void> {
        const model = await this.notebookStorage.load(document.uri);
        await this.executionProvider.executeCell(model, document, cell, token);
    }
    public async executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void> {
        const model = await this.notebookStorage.load(document.uri);
        await this.executionProvider.executeCell(model, document, undefined, token);
    }
}
