// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';

import { ILogger } from '../common/types';
import { noop } from '../common/utils/misc';
import { RegExpValues } from './constants';
import { ICell, IJupyterExecution, INotebookExporter, ISysInfo } from './types';

@injectable()
export class JupyterExporter implements INotebookExporter {

    constructor(
        @inject(IJupyterExecution) private jupyterExecution : IJupyterExecution,
        @inject(ILogger) private logger: ILogger) {
    }

    public dispose() {
        noop();
    }

    public async translateToNotebook(cells: ICell[]) : Promise<nbformat.INotebookContent | undefined> {
        // First compute our python version number
        const pythonNumber = await this.extractPythonMainVersion(cells);

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

    private extractPythonMainVersion = async (cells: ICell[]): Promise<number> => {
        let pythonVersion;
        const sysInfoCells = cells.filter((targetCell: ICell) => {
           return targetCell.data.cell_type === 'sys_info';
        });

        if (sysInfoCells.length > 0) {
            const sysInfo = sysInfoCells[0].data as ISysInfo;
            const fullVersionString = sysInfo.version;
            if (fullVersionString) {
                pythonVersion = fullVersionString.substr(0, fullVersionString.indexOf('.'));
                return Number(pythonVersion);
            }
        }

        this.logger.logInformation('Failed to find python main version from sys_info cell');

        // In this case, let's check the version on the active interpreter
        const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
        return usableInterpreter ? usableInterpreter.version_info[0] : 3;
    }
}
