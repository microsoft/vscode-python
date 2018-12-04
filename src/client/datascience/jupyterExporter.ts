// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';

import { noop } from '../common/utils/misc';
import { RegExpValues } from './constants';
import { ICell, IJupyterExecution, INotebookExporter } from './types';

@injectable()
export class JupyterExporter implements INotebookExporter {

    constructor(
        @inject(IJupyterExecution) private jupyterExecution : IJupyterExecution) {
    }

    public dispose() {
        noop();
    }

    public async translateToNotebook(cells: ICell[]) : Promise<nbformat.INotebookContent | undefined> {
        const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
        const pythonNumber = usableInterpreter ? usableInterpreter.version_info[0] : 3;

        // Use this to build our metadata object
        const metadata: nbformat.INotebookMetadata = {
            language_info: {
                name: 'python',
                codemirror_mode: {
                    name: 'ipython',
                    version: pythonNumber
                }
            },
            orig_nbformat: 2,
            file_extension: '.py',
            mimetype: 'text/x-python',
            name: 'python',
            npconvert_exporter: 'python',
            pygments_lexer: `ipython${pythonNumber}`,
            version: pythonNumber
        };

        // Combine this into a JSON object
        return {
            cells: this.pruneCells(cells),
            nbformat: 4,
            nbformat_minor: 2,
            metadata: metadata
        };
    }

    private pruneCells = (cells : ICell[]) : nbformat.IBaseCell[] => {
        // First filter out sys info cells. Jupyter doesn't understand these
        return cells.filter(c => c.data.cell_type !== 'sys_info')
            // Then prune each cell down to just the cell data.
            .map(this.pruneCell);
    }

    private pruneCell = (cell : ICell) : nbformat.IBaseCell => {
        // Remove the #%% of the top of the source if there is any. We don't need
        // this to end up in the exported ipynb file.
        const copy = {...cell.data};
        copy.source = this.pruneSource(cell.data.source);
        return copy;
    }

    private pruneSource = (source : nbformat.MultilineString) : nbformat.MultilineString => {

        if (Array.isArray(source) && source.length > 0) {
            if (RegExpValues.PythonCellMarker.test(source[0])) {
                return source.slice(1);
            }
        } else {
            const array = source.toString().split('\n').map(s => `${s}\n`);
            if (array.length > 0 && RegExpValues.PythonCellMarker.test(array[0])) {
                return array.slice(1);
            }
        }

        return source;
    }
}
