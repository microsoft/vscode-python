// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { nbformat } from '@jupyterlab/coreutils';
import { Memento, Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../common/application/types';
import { ICryptoUtils } from '../../common/types';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { NotebookCellLanguageService } from '../notebook/defaultCellLanguageService';
import {
    cellRunStateToCellState,
    createJupyterCellFromVSCNotebookCell,
    getNotebookMetadata,
    notebookModelToVSCNotebookData,
    updateVSCNotebookAfterTrustingNotebook
} from '../notebook/helpers/helpers';
import { BaseNotebookModel, getDefaultNotebookContentForNativeNotebooks } from './baseModel';

// https://github.com/microsoft/vscode-python/issues/13155
// tslint:disable-next-line: no-any
export function sortObjectPropertiesRecursively(obj: any): any {
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
    public get trustedAfterOpeningNotebook() {
        return this._trustedAfterOpeningNotebook === true;
    }
    public get isDirty(): boolean {
        return this.document?.isDirty === true;
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
    public get notebookContentWithoutCells(): Exclude<Partial<nbformat.INotebookContent>, 'cells'> {
        return {
            ...this.notebookJson,
            cells: []
        };
    }
    public get isUntitled(): boolean {
        return this.document ? this.document.isUntitled : super.isUntitled;
    }
    private _cells: nbformat.IBaseCell[] = [];
    private _trustedAfterOpeningNotebook? = false;
    private document?: NotebookDocument;
    private readonly _preferredLanguage?: string;

    constructor(
        isTrusted: boolean,
        file: Uri,
        globalMemento: Memento,
        crypto: ICryptoUtils,
        json: Partial<nbformat.INotebookContent> = {},
        indentAmount: string = ' ',
        pythonNumber: number = 3,
        private readonly vscodeNotebook: IVSCodeNotebook,
        private readonly cellLanguageService: NotebookCellLanguageService
    ) {
        super(isTrusted, file, globalMemento, crypto, json, indentAmount, pythonNumber, false);
        // Do not change this code without changing code in base class.
        // We cannot invoke this in base class as `cellLanguageService` is not available in base class.
        this.ensureNotebookJson();
        this._cells = this.notebookJson.cells || [];
        this._preferredLanguage = cellLanguageService.getPreferredLanguage(this.metadata);
    }
    public getCellCount() {
        return this.document ? this.document.cells.length : this._cells.length;
    }
    public getNotebookData() {
        if (!this._preferredLanguage) {
            throw new Error('Preferred Language not initialized');
        }
        return notebookModelToVSCNotebookData(
            this.isTrusted,
            this.notebookContentWithoutCells,
            this.file,
            this.notebookJson.cells || [],
            this._preferredLanguage
        );
    }
    public markAsReloadedAfterTrusting() {
        this._trustedAfterOpeningNotebook = false;
    }
    public getCellsWithId() {
        if (!this.document) {
            return [];
        }
        return this.document.cells.map((cell) => {
            return {
                id: cell.uri.toString(),
                data: createJupyterCellFromVSCNotebookCell(cell),
                state: cellRunStateToCellState(cell.metadata.runState)
            };
        });
    }
    /**
     * Unfortunately Notebook models are created early, well before a VSC Notebook Document is created.
     * We can associate an INotebookModel with a VSC Notebook, only after the Notebook has been opened.
     */
    public associateNotebookDocument(document: NotebookDocument) {
        this.document = document;
    }
    public trust() {
        // this._doNotUseOldCells = true;
        super.trust();
        this._cells = [];
    }
    public async trustNotebook() {
        super.trust();
        if (this.document) {
            const editor = this.vscodeNotebook?.notebookEditors.find((item) => item.document === this.document);
            if (editor) {
                await updateVSCNotebookAfterTrustingNotebook(editor, this.document, this._cells);
            }
            // We don't need old cells.
            this._cells = [];
            this._trustedAfterOpeningNotebook = true;
        }
    }
    public getOriginalContentOnDisc(): string {
        return JSON.stringify(this.notebookJson, null, this.indentAmount);
    }
    protected getJupyterCells() {
        return this.document
            ? this.document.cells.map(createJupyterCellFromVSCNotebookCell.bind(undefined))
            : this.notebookJson.cells || [];
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
        // if (this.document && !this.isTrusted && Array.isArray(json.cells)) {
        if (Array.isArray(json.cells)) {
            // The output can contain custom metadata, we need to remove that.
            json.cells = json.cells.map((cell) => {
                const metadata = { ...cell.metadata };
                // tslint:disable-next-line: no-any
                const outputs: nbformat.IOutput[] = Array.isArray(cell.outputs) ? (cell.outputs as any) : [];
                outputs.forEach((output: nbformat.IOutput) => {
                    if (
                        output &&
                        output.metadata &&
                        typeof output.metadata === 'object' &&
                        'vscode' in output.metadata
                    ) {
                        delete output.metadata.vscode;
                    }
                });
                // if ('vscode' in metadata && typeof metadata === 'object') {
                //     delete metadata.vscode;
                // }
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
