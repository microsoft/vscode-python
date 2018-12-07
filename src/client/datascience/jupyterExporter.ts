// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';

import * as path from 'path';
import { IWorkspaceService } from '../common/application/types';
import { ILogger } from '../common/types';
import * as localize from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { CodeSnippits, RegExpValues } from './constants';
import { CellState, ICell, IJupyterExecution, INotebookExporter, ISysInfo } from './types';

@injectable()
export class JupyterExporter implements INotebookExporter {

    constructor(
        @inject(IJupyterExecution) private jupyterExecution : IJupyterExecution,
        @inject(ILogger) private logger: ILogger,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService) {
    }

    public dispose() {
        noop();
    }

    public async translateToNotebook(cells: ICell[], changeDirectory?: string) : Promise<nbformat.INotebookContent | undefined> {
        // If requested, add in a change directory cell to fix relative paths
        if (changeDirectory) {
            cells = this.addDirectoryChangeCell(cells, changeDirectory);
        }

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

    // For exporting, put in a cell that will change the working directory back to the workspace directory so relative data paths will load correctly
    private addDirectoryChangeCell = (cells: ICell[], file: string): ICell[] => {
        const changeDirectory = this.calculateDirectoryChange(file);

        if (changeDirectory) {
            const exportChangeDirectory = CodeSnippits.ChangeDirectory.format(localize.DataScience.exportChangeDirectoryComment(), changeDirectory);
            const cell: ICell = {
                data: {
                    source: exportChangeDirectory,
                    cell_type: 'code',
                    outputs: [],
                    metadata: {},
                    execution_count: 0
                },
                id: uuid(),
                file: '',
                line: 0,
                state: CellState.finished
            };

            return [cell, ...cells];
        } else {
            return cells;
        }
    }

    private calculateDirectoryChange = (notebookFile: string): string | undefined => {
        let directoryChange: string | undefined;
        const notebookFilePath = path.dirname(notebookFile);
        // First see if we have a workspace open, this only works if we have a workspace root to be relative to
        if (this.workspaceService && this.workspaceService.workspaceFolders && this.workspaceService.workspaceFolders.length > 0) {
            const workspacePath = this.workspaceService.workspaceFolders[0].uri.fsPath;

            // Make sure that we have everything that we need here
            if (workspacePath && path.isAbsolute(workspacePath) && notebookFilePath && path.isAbsolute(notebookFilePath)) {
                directoryChange = path.relative(notebookFilePath, workspacePath);
            }
        }

        // If path.relative can't calculate a relative path, then it just returns the full second path
        // so check here, we only want this if we were able to calculate a relative path, no network shares or drives
        if (directoryChange && !path.isAbsolute(directoryChange)) {
            return directoryChange;
        } else {
            return undefined;
        }
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
