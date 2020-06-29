// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { nbformat } from '@jupyterlab/coreutils';
import * as assert from 'assert';
import { Uri } from 'vscode';
import { IBaseCellVSCodeMetadata } from '../../../../types/@jupyterlab_coreutils_nbformat';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { splitMultilineString } from '../../../datascience-ui/common';
import { traceError } from '../../common/logger';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { ICell } from '../types';
import { BaseNotebookModel } from './baseModel';

// Exported for test mocks
export class VSCodeNotebookModel extends BaseNotebookModel {
    public get isDirty(): boolean {
        return this.document?.isDirty === true;
    }
    private document?: NotebookDocument;

    constructor(
        isTrusted: boolean,
        file: Uri,
        cells: ICell[],
        json: Partial<nbformat.INotebookContent> = {},
        indentAmount: string = ' ',
        pythonNumber: number = 3
    ) {
        super(isTrusted, file, cells, json, indentAmount, pythonNumber);
    }
    /**
     * Unfortunately Notebook models are created early, well before a VSC Notebook Document is created.
     * We can associate an INotebookModel with a VSC Notebook, only after the Notebook has been opened.
     */
    public associateNotebookDocument(document: NotebookDocument) {
        this.document = document;
    }
    public updateCellSource(cellId: string, source: string): void {
        const cell = this.getCell(cellId);
        if (cell) {
            cell.data.source = splitMultilineString(source);
        }
    }
    public clearCellOutput(cell: ICell): void {
        if (cell.data.cell_type === 'code') {
            cell.data.execution_count = null;
        }
        if (cell.data.metadata.vscode) {
            cell.data.metadata.vscode.start_execution_time = undefined;
            cell.data.metadata.vscode.end_execution_time = undefined;
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
        const originalVscodeMetadata: IBaseCellVSCodeMetadata = cell.data.metadata.vscode || {};
        // Update our model with the new metadata stored in jupyter.
        cell.data.metadata = {
            ...cell.data.metadata,
            vscode: {
                ...originalVscodeMetadata,
                ...metadata
            }
        };
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
