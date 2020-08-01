// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import { Memento, Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { splitMultilineString } from '../../../datascience-ui/common';
import { traceError } from '../../common/logger';
import { ICryptoUtils } from '../../common/types';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { createCellFromVSCNotebookCell, updateVSCNotebookAfterTrustingNotebook } from '../notebook/helpers/helpers';
import { ICell } from '../types';
import { BaseNotebookModel } from './baseModel';

// This is the custom type we are adding into nbformat.IBaseCellMetadata
interface IBaseCellVSCodeMetadata {
    end_execution_time?: string;
    start_execution_time?: string;
}

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
        return this.document
            ? this.document.cells.map((cell) => createCellFromVSCNotebookCell(cell, this))
            : this._cells;
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
        pythonNumber: number = 3
    ) {
        super(isTrusted, file, cells, globalMemento, crypto, json, indentAmount, pythonNumber);
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
            updateVSCNotebookAfterTrustingNotebook(this.document, this._cells);
            // We don't need old cells.
            this._cells = [];
        }
    }
    public updateCellSource(cellId: string, source: string): void {
        const cell = this.getCell(cellId);
        if (cell) {
            cell.data.source = splitMultilineString(source);
        }
    }
    public clearCellOutput(cell: ICell, clearExecutionCount: boolean): void {
        if (cell.data.cell_type === 'code' && clearExecutionCount) {
            cell.data.execution_count = null;
        }
        if (cell.data.metadata.vscode) {
            (cell.data.metadata.vscode as IBaseCellVSCodeMetadata).start_execution_time = undefined;
            (cell.data.metadata.vscode as IBaseCellVSCodeMetadata).end_execution_time = undefined;
        }
        cell.data.outputs = [];
        // We want to trigger change events.
        this.update({
            source: 'user',
            kind: 'clear',
            oldDirty: this.isDirty,
            newDirty: true,
            oldCells: [cell]
        });
    }
    /**
     * @param {number} start The zero-based location in the array after which the new item is to be added.
     */
    public addCell(cell: ICell, start: number): void {
        this._cells.splice(start, 0, cell);
        // Get model to fire events.
        this.update({
            source: 'user',
            kind: 'insert',
            cell: cell,
            index: start,
            oldDirty: this.isDirty,
            newDirty: true
        });
    }
    public deleteCell(cell: ICell): void {
        const index = this._cells.indexOf(cell);
        this._cells.splice(index, 1);
        // Get model to fire events.
        this.update({
            source: 'user',
            kind: 'remove',
            cell: cell,
            index: index,
            oldDirty: this.isDirty,
            newDirty: true
        });
    }
    public swapCells(cellToSwap: ICell, cellToSwapWith: ICell) {
        assert.notEqual(cellToSwap, cellToSwapWith, 'Cannot swap cell with the same cell');

        const indexOfCellToSwap = this.cells.indexOf(cellToSwap);
        const indexOfCellToSwapWith = this.cells.indexOf(cellToSwapWith);
        this._cells[indexOfCellToSwap] = cellToSwapWith;
        this._cells[indexOfCellToSwapWith] = cellToSwap;
        // Get model to fire events.
        this.update({
            source: 'user',
            kind: 'swap',
            firstCellId: cellToSwap.id,
            secondCellId: cellToSwapWith.id,
            oldDirty: this.isDirty,
            newDirty: true
        });
    }
    public updateCellOutput(cell: ICell, outputs: nbformat.IOutput[]) {
        cell.data.outputs = outputs;
    }
    public updateCellExecutionCount(cell: ICell, executionCount: number) {
        cell.data.execution_count = executionCount;
    }
    public updateCellMetadata(cell: ICell, metadata: Partial<IBaseCellVSCodeMetadata>) {
        const originalVscodeMetadata: IBaseCellVSCodeMetadata =
            (cell.data.metadata.vscode as IBaseCellVSCodeMetadata) || {};
        // Update our model with the new metadata stored in jupyter.
        cell.data.metadata = {
            ...cell.data.metadata,
            vscode: {
                ...originalVscodeMetadata,
                ...metadata
            }
            // This line is required because ts-node sucks on GHA.
            // tslint:disable-next-line: no-any
        } as any;
    }
    protected generateNotebookJson() {
        const json = super.generateNotebookJson();
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
    private getCell(cellId: string) {
        const cell = this.cells.find((item) => item.id === cellId);
        if (!cell) {
            traceError(
                `Syncing Cell Editor aborted, Unable to find corresponding ICell for ${cellId}`,
                new Error('ICell not found')
            );
            return;
        }
        return cell;
    }
}
