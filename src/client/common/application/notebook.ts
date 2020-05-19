// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import {
    Disposable,
    Event,
    GlobPattern,
    notebook,
    NotebookContentProvider,
    NotebookDocument,
    NotebookDocumentChangeEvent,
    NotebookEditor,
    NotebookKernel,
    NotebookOutputRenderer,
    NotebookOutputSelector,
    TextDocument,
    window
} from 'vscode';
import { UseProposedApi } from '../constants';
import { IVSCodeNotebook } from './types';

@injectable()
export class VSCodeNotebook implements IVSCodeNotebook {
    constructor(@inject(UseProposedApi) private readonly useProposedApi: boolean) {}
    public registerNotebookContentProvider(notebookType: string, provider: NotebookContentProvider): Disposable {
        return notebook.registerNotebookContentProvider(notebookType, provider);
    }
    public registerNotebookKernel(id: string, selectors: GlobPattern[], kernel: NotebookKernel): Disposable {
        return notebook.registerNotebookKernel(id, selectors, kernel);
    }
    public registerNotebookOutputRenderer(
        id: string,
        outputSelector: NotebookOutputSelector,
        renderer: NotebookOutputRenderer
    ): Disposable {
        return notebook.registerNotebookOutputRenderer(id, outputSelector, renderer);
    }
    public get onDidOpenNotebookDocument(): Event<NotebookDocument> {
        return notebook.onDidOpenNotebookDocument;
    }
    public get onDidCloseNotebookDocument(): Event<NotebookDocument> {
        return notebook.onDidCloseNotebookDocument;
    }

    public get onDidChangeNotebookDocument(): Event<NotebookDocumentChangeEvent> {
        return notebook.onDidChangeNotebookDocument;
    }
    public isCell(textDocument: TextDocument) {
        return (
            textDocument.fileName.toLowerCase().includes('.ipynb') &&
            textDocument.uri.query.includes('notebook') &&
            textDocument.uri.query.includes('cell')
        );
    }
    public get activeNotebookEditor(): NotebookEditor | undefined {
        if (!this.useProposedApi) {
            return;
        }
        // Temporary, currently VSC API doesn't work well.
        // `notebook.activeNotebookEditor`  is not reset when opening another file.
        if (!notebook.activeNotebookEditor) {
            return;
        }
        // If we have a text editor opened and it is not a cell, then we know for certain a notebook is not open.
        if (window.activeTextEditor && !this.isCell(window.activeTextEditor.document)) {
            return;
        }
        return notebook.activeNotebookEditor;
    }
}
