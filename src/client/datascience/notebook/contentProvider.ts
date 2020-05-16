// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    CancellationToken,
    EventEmitter,
    NotebookContentProvider as VSCodeNotebookContentProvider,
    NotebookData,
    NotebookDocument,
    NotebookDocumentEditEvent,
    Uri
} from 'vscode';
import { INotebookStorageProvider } from '../interactive-ipynb/notebookStorageProvider';
import { notebookModelToVSCNotebookData } from './helpers';

/**
 * This class is responsible for reading a notebook file (ipynb or other files) and returning VS Code with the NotebookData.
 * Its upto extension authors to read the files and return it in a format that VSCode understands.
 * Same with the cells and cell output.
 *
 * Also responsbile for saving of notebooks.
 * When saving, VSC will provide their model and we need to take that and merge it with an existing ipynb json (if any, to preserve metadata).
 */
@injectable()
export class NotebookContentProvider implements VSCodeNotebookContentProvider {
    private notebookChanged = new EventEmitter<NotebookDocumentEditEvent>();
    public get onDidChangeNotebook() {
        return this.notebookChanged.event;
    }
    constructor(@inject(INotebookStorageProvider) private readonly notebookStorage: INotebookStorageProvider) {}
    public async openNotebook(uri: Uri): Promise<NotebookData> {
        const model = await this.notebookStorage.load(uri);
        return notebookModelToVSCNotebookData(model);
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
}
