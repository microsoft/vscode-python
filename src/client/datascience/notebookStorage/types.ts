// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { Uri } from 'vscode';
import { ICell, INotebookModel } from '../types';

export const INotebookModelFactory = Symbol('INotebookModelFactory');
export interface INotebookModelFactory {
    createModel(
        options: {
            trusted: boolean;
            file: Uri;
            cells: ICell[];
            notebookJson?: Partial<nbformat.INotebookContent>;
            indentAmount?: string;
            pythonNumber?: number;
            initiallyDirty?: boolean;
        },
        forVSCodeNotebook?: boolean
    ): INotebookModel;
}
