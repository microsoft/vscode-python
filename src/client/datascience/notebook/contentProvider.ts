// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    CancellationToken,
    EventEmitter,
    NotebookCell,
    NotebookContentProvider as VSCodeNotebookContentProvider,
    NotebookData,
    NotebookDocument,
    NotebookDocumentEditEvent,
    Uri
} from 'vscode';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { NotebookExecutionProvider } from './executionProvider';
import { notebookModelToNotebookData } from './helpers';

@injectable()
export class NotebookContentProvider implements VSCodeNotebookContentProvider {
    private notebookChanged = new EventEmitter<NotebookDocumentEditEvent>();
    public get onDidChangeNotebook() {
        return this.notebookChanged.event;
    }
    constructor(
        @inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider,
        @inject(NotebookExecutionProvider) private readonly executionProvider: NotebookExecutionProvider
    ) {}
    public async openNotebook(uri: Uri): Promise<NotebookData> {
        const model = await this.notebookStorage.load(uri);
        return notebookModelToNotebookData(model);
    }
    public async saveNotebook(document: NotebookDocument, cancellation: CancellationToken) {
        const model = await this.notebookStorage.load(document.uri);
        if (model.isUntitled) {
            return;
        }
        await this.notebookStorage.save(model, cancellation);
    }

    public async saveNotebookAs(
        targetResource: Uri,
        document: NotebookDocument,
        cancellation: CancellationToken
    ): Promise<void> {
        const model = await this.notebookStorage.load(document.uri);
        if (!cancellation.isCancellationRequested) {
            await this.notebookStorage.saveAs(model, targetResource);
        }
    }
    public async executeCell(
        document: NotebookDocument,
        cell: NotebookCell | undefined,
        token: CancellationToken
    ): Promise<void> {
        const model = await this.notebookStorage.load(document.uri);
        await this.executionProvider.executeCell(model, document, cell, token);
    }
}
