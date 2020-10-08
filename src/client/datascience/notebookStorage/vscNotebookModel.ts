// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { nbformat } from '@jupyterlab/coreutils';
import { Memento, Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { ICryptoUtils } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { NotebookCellLanguageService } from '../notebook/defaultCellLanguageService';
import {
    createCellFromVSCNotebookCell,
    getNotebookMetadata,
    updateVSCNotebookAfterTrustingNotebook
} from '../notebook/helpers/helpers';
import { ICell } from '../types';
import { BaseNotebookModel, getDefaultNotebookContentForNativeNotebooks } from './baseModel';

// https://github.com/microsoft/vscode-python/issues/13155
// tslint:disable-next-line: no-any
function sortObjectPropertiesRecursively(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(sortObjectPropertiesRecursively);
    }
    if (obj !== undefined && obj !== null && typeof obj === 'object' && Object.keys(obj).length > 0) {
        return (
            Object.keys(obj)
                .sort()
                // tslint:disable-next-line: no-any
                .reduce<Record<string, any>>((sortedObj, prop) => {
                    sortedObj[prop] = sortObjectPropertiesRecursively(obj[prop]);
                    return sortedObj;
                    // tslint:disable-next-line: no-any
                }, {}) as any
        );
    }
    return obj;
}

// Exported for test mocks
export class VSCodeNotebookModel extends BaseNotebookModel {
    public get isDirty(): boolean {
        return this.document?.isDirty === true;
    }
    public get cells(): ICell[] {
        // Possible the document has been closed/disposed
        if (this.isDisposed) {
            return [];
        }

        // When a notebook is not trusted, return original cells.
        // This is because the VSCode NotebookDocument object will not have any output in the cells.
        return this.document && this.isTrusted
            ? this.document.cells.map((cell) => createCellFromVSCNotebookCell(cell, this))
            : this._cells;
    }
    public get isDisposed() {
        // Possible the document has been closed/disposed
        if (
            this.document &&
            this.vscodeNotebook &&
            !this.vscodeNotebook?.notebookDocuments.find((doc) => doc === this.document)
        ) {
            return true;
        }
        return this._isDisposed === true;
    }
    public get notebookContentWithoutCells(): Partial<nbformat.INotebookContent> {
        return {
            ...this.notebookJson,
            cells: []
        };
    }
    public get isUntitled(): boolean {
        return this.document ? this.document.isUntitled : super.isUntitled;
    }

    private document?: NotebookDocument;

    constructor(
        isTrusted: boolean,
        file: Uri,
        cells: ICell[],
        globalMemento: Memento,
        crypto: ICryptoUtils,
        json: Partial<nbformat.INotebookContent> = {},
        indentAmount: string = ' ',
        pythonNumber: number = 3,
        private readonly vscodeNotebook: IVSCodeNotebook,
        private readonly cellLanguageService: NotebookCellLanguageService
    ) {
        super(isTrusted, file, cells, globalMemento, crypto, json, indentAmount, pythonNumber, false);
        // Do not change this code without changing code in base class.
        // We cannot invoke this in base class as `cellLanguageService` is not available in base class.
        this.ensureNotebookJson();
    }

    /**
     * Unfortunately Notebook models are created early, well before a VSC Notebook Document is created.
     * We can associate an INotebookModel with a VSC Notebook, only after the Notebook has been opened.
     */
    public associateNotebookDocument(document: NotebookDocument) {
        this.document = document;
    }
    public trust() {
        super.trust();
        if (this.document) {
            const editor = this.vscodeNotebook?.notebookEditors.find((item) => item.document === this.document);
            if (editor) {
                updateVSCNotebookAfterTrustingNotebook(editor, this.document, this._cells).then(noop, noop);
            }
            // We don't need old cells.
            this._cells = [];
        }
    }
    protected getDefaultNotebookContent() {
        return getDefaultNotebookContentForNativeNotebooks(this.cellLanguageService?.getPreferredLanguage());
    }
    protected generateNotebookJson() {
        const json = super.generateNotebookJson();
        if (this.document && this.isTrusted) {
            // The metadata will be in the notebook document.
            const metadata = getNotebookMetadata(this.document);
            if (metadata) {
                json.metadata = metadata;
            }
        }
        if (this.document && !this.isTrusted && Array.isArray(json.cells)) {
            // The output can contain custom metadata, we need to remove that.
            json.cells = json.cells.map((cell) => {
                const metadata = { ...cell.metadata };
                if ('vscode' in metadata) {
                    delete metadata.vscode;
                }
                return {
                    ...cell,
                    metadata
                    // tslint:disable-next-line: no-any
                } as any;
            });
        }

        // https://github.com/microsoft/vscode-python/issues/13155
        // Object keys in metadata, cells and the like need to be sorted alphabetically.
        // Jupyter (Python) seems to sort them alphabetically.
        // We should do the same to minimize changes to content when saving ipynb.
        return sortObjectPropertiesRecursively(json);
    }

    protected handleRedo(change: NotebookModelChange): boolean {
        super.handleRedo(change);
        return true;
    }
}
