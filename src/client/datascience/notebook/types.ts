// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { NotebookContentProvider as VSCodeNotebookContentProvider, NotebookDocument } from 'vscode-proposed';

export const INotebookContentProvider = Symbol('INotebookContentProvider');
export interface INotebookContentProvider extends VSCodeNotebookContentProvider {
    /**
     * Notify VS Code that document has changed.
     * The change is not something that can be undone by using the `undo`.
     * E.g. updating execution count of a cell, or making a notebook readonly, or updating kernel info in ipynb metadata.
     */
    notifyChangesToDocument(document: NotebookDocument): void;
}
