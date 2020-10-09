// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { inject, injectable } from 'inversify';
import { Memento, Uri } from 'vscode';
import { IVSCodeNotebook } from '../../common/application/types';
import { UseVSCodeNotebookEditorApi } from '../../common/constants';
import { ICryptoUtils } from '../../common/types';
import { NotebookCellLanguageService } from '../notebook/defaultCellLanguageService';
import { ICell, INotebookModel } from '../types';
import { NativeEditorNotebookModel } from './notebookModel';
import { INotebookModelFactory } from './types';
import { VSCodeNotebookModel } from './vscNotebookModel';

@injectable()
export class NotebookModelFactory implements INotebookModelFactory {
    constructor(
        @inject(UseVSCodeNotebookEditorApi) private readonly useVSCodeNotebookEditorApi: boolean,
        @inject(IVSCodeNotebook) private vsCodeNotebook: IVSCodeNotebook,
        @inject(NotebookCellLanguageService) private readonly cellLanguageService: NotebookCellLanguageService
    ) {}
    public createModel(
        options: {
            trusted: boolean;
            file: Uri;
            cells: ICell[];
            notebookJson?: Partial<nbformat.INotebookContent>;
            globalMemento: Memento;
            crypto: ICryptoUtils;
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
                options.globalMemento,
                options.crypto,
                options.notebookJson,
                options.indentAmount,
                options.pythonNumber,
                this.vsCodeNotebook,
                this.cellLanguageService
            );
        }
        return new NativeEditorNotebookModel(
            options.trusted,
            options.file,
            options.cells,
            options.globalMemento,
            options.crypto,
            options.notebookJson,
            options.indentAmount,
            options.pythonNumber,
            options.initiallyDirty
        );
    }
}
