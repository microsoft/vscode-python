// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { IFileSystem } from '../../common/platform/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { Identifiers } from '../constants';
import { ICell, IJupyterVariable, IJupyterVariables, INotebookServerManager } from '../types';

@injectable()
export class JupyterVariables implements IJupyterVariables {
    private fetchVariablesScript?: string;

    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(INotebookServerManager) private jupyterServerManager: INotebookServerManager
        ) {
    }

    // IJupyterVariables implementation
    public async getVariables(): Promise<IJupyterVariable[]> {
        // First make sure our python file is loaded up
        if (!this.fetchVariablesScript) {
            await this.loadVariablesFile();
        }

        const activeServer = this.jupyterServerManager.getActiveServer();
        if (!activeServer) {
            // No active server will just return an empty list
            return [];
        }

        // Get our results and convert them to IJupyterVariable objects
        const results = await activeServer.execute(this.fetchVariablesScript!, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
        return this.deserializeVariableData(results);
    }

    // Private methods
    private async loadVariablesFile(): Promise<void> {
        if (this.fetchVariablesScript) {
            return;
        }

        const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableList.py');
        this.fetchVariablesScript = await this.fileSystem.readFile(file);
    }

    private deserializeVariableData(cells: ICell[]): IJupyterVariable[] {
        // Verify that we have the correct cell type and outputs
        if (cells.length > 0 && cells[0].data) {
            const codeCell = cells[0].data as nbformat.ICodeCell;
            if (codeCell.outputs.length > 0) {
                const codeCellOutput = codeCell.outputs[0] as nbformat.IOutput;
                if (codeCellOutput.data && codeCellOutput.data.hasOwnProperty('text/plain')) {
                    // tslint:disable-next-line:no-any
                    let resultString = ((codeCellOutput.data as any)['text/plain']);

                    // Trim the excess ' character on the string
                    resultString = resultString.slice(1, resultString.length - 1);

                    return JSON.parse(resultString) as IJupyterVariable[];
                }
            }
        }

        throw new Error(localize.DataScience.jupyterGetVariablesBadResults());
    }
}
