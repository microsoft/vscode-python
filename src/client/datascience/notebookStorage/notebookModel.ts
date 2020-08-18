// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import * as fastDeepEqual from 'fast-deep-equal';
import * as uuid from 'uuid/v4';
import { Memento, Uri } from 'vscode';
import { concatMultilineString, splitMultilineString } from '../../../datascience-ui/common';
import { createCodeCell } from '../../../datascience-ui/common/cellFactory';
import { ICryptoUtils } from '../../common/types';
import { Identifiers } from '../constants';
import { IEditorContentChange, NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { CellState, ICell } from '../types';
import { BaseNotebookModel } from './baseModel';

export class NativeEditorNotebookModel extends BaseNotebookModel {
    public get id() {
        return this._id;
    }
    private _id = uuid();
    private saveChangeCount: number = 0;
    private changeCount: number = 0;
    public get isDirty(): boolean {
        return this.changeCount !== this.saveChangeCount;
    }
    constructor(
        isTrusted: boolean,
        file: Uri,
        cells: ICell[],
        globalMemento: Memento,
        crypto: ICryptoUtils,
        json: Partial<nbformat.INotebookContent> = {},
        indentAmount: string = ' ',
        pythonNumber: number = 3,
        isInitiallyDirty: boolean = false
    ) {
        super(isTrusted, file, cells, globalMemento, crypto, json, indentAmount, pythonNumber);
        if (isInitiallyDirty) {
            // This means we're dirty. Indicate dirty and load from this content
            this.saveChangeCount = -1;
        }
    }

    public async applyEdits(edits: readonly NotebookModelChange[]): Promise<void> {
        edits.forEach((e) => this.update({ ...e, source: 'redo' }));
    }
    public async undoEdits(edits: readonly NotebookModelChange[]): Promise<void> {
        edits.forEach((e) => this.update({ ...e, source: 'undo' }));
    }

    protected handleRedo(change: NotebookModelChange): boolean {
        let changed = false;
        switch (change.kind) {
            case 'clear':
                changed = this.clearOutputs();
                break;
            case 'edit':
                changed = this.editCell(change.forward, change.id);
                break;
            case 'insert':
                changed = this.insertCell(change.cell, change.index);
                break;
            case 'changeCellType':
                changed = this.changeCellType(change.cell);
                break;
            case 'modify':
                changed = this.modifyCells(change.newCells);
                break;
            case 'remove':
                changed = this.removeCell(change.cell);
                break;
            case 'remove_all':
                changed = this.removeAllCells(change.newCellId);
                break;
            case 'swap':
                changed = this.swapCells(change.firstCellId, change.secondCellId);
                break;
            case 'updateCellExecutionCount':
                changed = this.updateCellExecutionCount(change.cellId, change.executionCount);
                break;
            case 'save':
                this.saveChangeCount = this.changeCount;
                break;
            case 'saveAs':
                this.saveChangeCount = this.changeCount;
                this.changeCount = this.saveChangeCount = 0;
                this._file = change.target;
                break;
            default:
                changed = super.handleRedo(change);
                break;
        }

        // Dirty state comes from undo. At least VS code will track it that way. However
        // skip file changes as we don't forward those to VS code
        if (change.kind !== 'save' && change.kind !== 'saveAs') {
            this.changeCount += 1;
        }

        return changed;
    }

    protected handleUndo(change: NotebookModelChange): boolean {
        let changed = false;
        switch (change.kind) {
            case 'clear':
                changed = !fastDeepEqual(this.cells, change.oldCells);
                this._cells = change.oldCells;
                break;
            case 'edit':
                this.editCell(change.reverse, change.id);
                changed = true;
                break;
            case 'changeCellType':
                this.changeCellType(change.cell);
                changed = true;
                break;
            case 'insert':
                changed = this.removeCell(change.cell);
                break;
            case 'modify':
                changed = this.modifyCells(change.oldCells);
                break;
            case 'remove':
                changed = this.insertCell(change.cell, change.index);
                break;
            case 'remove_all':
                this._cells = change.oldCells;
                changed = true;
                break;
            case 'swap':
                changed = this.swapCells(change.firstCellId, change.secondCellId);
                break;
            default:
                break;
        }

        // Dirty state comes from undo. At least VS code will track it that way.
        // Note unlike redo, 'file' and 'version' are not possible on undo as
        // we don't send them to VS code.
        this.changeCount -= 1;

        return changed;
    }

    private removeAllCells(newCellId: string) {
        this._cells = [];
        this._cells.push(this.createEmptyCell(newCellId));
        return true;
    }

    private applyCellContentChange(change: IEditorContentChange, id: string): boolean {
        const normalized = change.text.replace(/\r/g, '');

        // Figure out which cell we're editing.
        const index = this.cells.findIndex((c) => c.id === id);
        if (index >= 0) {
            // This is an actual edit.
            const contents = concatMultilineString(this.cells[index].data.source);
            const before = contents.substr(0, change.rangeOffset);
            const after = contents.substr(change.rangeOffset + change.rangeLength);
            const newContents = `${before}${normalized}${after}`;
            if (contents !== newContents) {
                const newCell = {
                    ...this.cells[index],
                    data: { ...this.cells[index].data, source: splitMultilineString(newContents) }
                };
                this._cells[index] = this.asCell(newCell);
                return true;
            }
        }
        return false;
    }

    private editCell(changes: IEditorContentChange[], id: string): boolean {
        // Apply the changes to the visible cell list
        if (changes && changes.length) {
            return changes.map((c) => this.applyCellContentChange(c, id)).reduce((p, c) => p || c, false);
        }

        return false;
    }

    private swapCells(firstCellId: string, secondCellId: string) {
        const first = this.cells.findIndex((v) => v.id === firstCellId);
        const second = this.cells.findIndex((v) => v.id === secondCellId);
        if (first >= 0 && second >= 0 && first !== second) {
            const temp = { ...this.cells[first] };
            this._cells[first] = this.asCell(this.cells[second]);
            this._cells[second] = this.asCell(temp);
            return true;
        }
        return false;
    }

    private updateCellExecutionCount(cellId: string, executionCount?: number) {
        const index = this.cells.findIndex((v) => v.id === cellId);
        if (index >= 0) {
            this._cells[index].data.execution_count =
                typeof executionCount === 'number' && executionCount > 0 ? executionCount : null;
            return true;
        }
        return false;
    }

    private modifyCells(cells: ICell[]): boolean {
        // Update these cells in our list
        cells.forEach((c) => {
            const index = this.cells.findIndex((v) => v.id === c.id);
            this._cells[index] = this.asCell(c);
        });
        return true;
    }

    private changeCellType(cell: ICell): boolean {
        // Update the cell in our list.
        const index = this.cells.findIndex((v) => v.id === cell.id);
        this._cells[index] = this.asCell(cell);
        return true;
    }

    private removeCell(cell: ICell): boolean {
        const index = this.cells.findIndex((c) => c.id === cell.id);
        if (index >= 0) {
            this.cells.splice(index, 1);
            return true;
        }
        return false;
    }

    private clearOutputs(): boolean {
        const newCells = this.cells.map((c) =>
            this.asCell({ ...c, data: { ...c.data, execution_count: null, outputs: [] } })
        );
        const result = !fastDeepEqual(newCells, this.cells);
        this._cells = newCells;
        return result;
    }

    private insertCell(cell: ICell, index: number): boolean {
        // Insert a cell into our visible list based on the index. They should be in sync
        this._cells.splice(index, 0, cell);
        return true;
    }

    // tslint:disable-next-line: no-any
    private asCell(cell: any): ICell {
        // Works around problems with setting a cell to another one in the nyc compiler.
        return cell as ICell;
    }

    private createEmptyCell(id: string) {
        return {
            id,
            line: 0,
            file: Identifiers.EmptyFileName,
            state: CellState.finished,
            data: createCodeCell()
        };
    }
}
