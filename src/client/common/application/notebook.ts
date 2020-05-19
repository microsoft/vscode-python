// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
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
    NotebookOutputSelector
} from 'vscode';
import { IVSCodeNotebook } from './types';

@injectable()
export class VSCodeNotebook implements IVSCodeNotebook {
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
    public get activeNotebookEditor(): NotebookEditor | undefined {
        return notebook.activeNotebookEditor;
    }
}
