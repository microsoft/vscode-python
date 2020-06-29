// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { UseVSCodeNotebookEditorApi } from '../../common/constants';
import { ICell, INotebookModel } from '../types';
import { NativeEditorNotebookModel } from './notebookModel';
import { INotebookModelFactory } from './types';
import { VSCodeNotebookModel } from './vscNotebookModel';

@injectable()
export class NotebookModelFactory implements INotebookModelFactory {
    constructor(@inject(UseVSCodeNotebookEditorApi) private readonly useVSCodeNotebookEditorApi: boolean) {}
    public createModel(
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
    ): INotebookModel {
        if (forVSCodeNotebook || this.useVSCodeNotebookEditorApi) {
            return new VSCodeNotebookModel(
                options.trusted,
                options.file,
                options.cells,
                options.notebookJson,
                options.indentAmount,
                options.pythonNumber
            );
        }
        return new NativeEditorNotebookModel(
            options.trusted,
            options.file,
            options.cells,
            options.notebookJson,
            options.indentAmount,
            options.pythonNumber,
            options.initiallyDirty
        );
    }
}
