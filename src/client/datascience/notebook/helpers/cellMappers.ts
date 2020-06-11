// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Responsible for mapping a VSC Cell to ICell & vice versa.
 *
 * A VS Code notebook has been opened.
 * We mapped ipynb cells to VS Code Notebook Cell Data.
 * VS Code then internally maps Notebook Cell Data to Notebook Cell.
 * Going forward VS Code always uses Notebook Cells.
 * We need to map Notebook Cells to ipynb cells (so when saving we can map VSC cells to our cells).
 */

import * as assert from 'assert';
import type { NotebookCell, NotebookDocument } from 'vscode-proposed';
import { ICell, INotebookModel } from '../../types';

/*
 * This file is responsible for managing the maps between ipynb cell to a VS Code Cell & vice versa.
 */

// The Cell Uri will never change (even when moving cells).
type VSCodeCellUri = string;
type ICellId = string;
const cellMapsByNotebookDocument = new WeakMap<NotebookDocument, Map<VSCodeCellUri, ICellId>>();
const mapOfCellsToNotebookCells = new WeakMap<ICell, VSCodeCellUri>();

export function mapVSCNotebookCellToCellModel(document: NotebookDocument, vscCell: NotebookCell, cell: ICell) {
    if (!cellMapsByNotebookDocument.has(document)) {
        cellMapsByNotebookDocument.set(document, new Map<VSCodeCellUri, ICellId>());
    }
    cellMapsByNotebookDocument.get(document)!.set(vscCell.uri.toString(), cell.id);
    mapOfCellsToNotebookCells.set(cell, vscCell.uri.toString());
}

export function getOriginalCellId(document: NotebookDocument, cell: NotebookCell): string | undefined {
    const map = cellMapsByNotebookDocument.get(document);
    if (!map) {
        return;
    }
    for (const [cellUri, iCellId] of map) {
        if (cell.uri.toString() === cellUri) {
            return iCellId;
        }
    }
}

/**
 * Map VSC Cells to our ICells.
 * When a notebook is opened, the document would be similar to the INotebookModel.
 * Hence same number of cells, and the like.
 * We can map each VSC Cell based on its index to our ICell.
 * This process will ensure we have an ininitial mapping of VSC Cells to our ICells.
 *
 * Call this method only when a notebook is opened.
 */
export function mapVSCNotebookCellsToNotebookCellModels(document: NotebookDocument, model: INotebookModel) {
    assert.equal(document.cells.length, model.cells.length, 'VS Code cell count and our cell count must be equal');
    const mapOfVSCCellToICell = new Map<VSCodeCellUri, ICellId>();
    cellMapsByNotebookDocument.set(document, mapOfVSCCellToICell);

    document.cells.forEach((vscCell, index) => {
        const cell = model.cells[index];
        mapVSCNotebookCellToCellModel(document, vscCell, cell);
    });
}

export function findMappedNotebookCell(source: ICell, cells: NotebookCell[]): NotebookCell {
    const uri = mapOfCellsToNotebookCells.get(source);
    const found = cells.filter((cell) => cell.uri.toString() === uri);

    assert.ok(found.length, `NotebookCell not found, for CellId = ${source.id} in ${source}`);

    return found[0];
}

export function findMappedNotebookCellModel(document: NotebookDocument, source: NotebookCell, cells: ICell[]): ICell {
    // If so, then we have a problem.
    const found = cells.filter((cell) => cell.id === getOriginalCellId(document, source));
    assert.ok(found.length, `ICell not found, for CellId = ${getOriginalCellId(document, source)} in ${source}`);

    return found[0];
}
