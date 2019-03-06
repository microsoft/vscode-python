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
import { ICell, IHistoryProvider, IJupyterExecution, IJupyterVariable, IJupyterVariables } from '../types';

@injectable()
export class JupyterVariables implements IJupyterVariables {
    private fetchVariablesScript?: string;
    private fetchVariableValueScript?: string;
    private filesLoaded: boolean = false;

    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IHistoryProvider) private historyProvider: IHistoryProvider
        ) {
    }

    // IJupyterVariables implementation
    public async getVariables(): Promise<IJupyterVariable[]> {
        if (!this.filesLoaded) {
            await this.loadVariableFiles();
        }

        const activeServer = await this.jupyterExecution.getServer(await this.historyProvider.getNotebookOptions());
        if (!activeServer) {
            // No active server will just return an empty list
            return [];
        }

        // Get our results and convert them to IJupyterVariable objects
        const results = await activeServer.execute(this.fetchVariablesScript!, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
        return this.deserializeJupyterResult<IJupyterVariable[]>(results);
    }

    public async getValue(targetVariable: IJupyterVariable): Promise<IJupyterVariable> {
        if (!this.filesLoaded) {
            await this.loadVariableFiles();
        }

        const activeServer = await this.jupyterExecution.getServer(await this.historyProvider.getNotebookOptions());
        if (!activeServer) {
            // No active server just return the unchanged target variable
            return targetVariable;
        }

        // Prep our targetVariable to send over
        const variableString = JSON.stringify(targetVariable);

        // Use just the name of the target variable to fetch the value
        const newScriptText = this.fetchVariableValueScript!.replace(/_VSCode_JupyterTestValue/g, variableString);
        const results = await activeServer.execute(newScriptText, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
        return this.deserializeJupyterResult<IJupyterVariable>(results);
    }

    // Private methods
    // Load our python files for fetching variables
    private async loadVariableFiles(): Promise<void> {
        let file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableList.py');
        this.fetchVariablesScript = await this.fileSystem.readFile(file);

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableValue.py');
        this.fetchVariableValueScript = await this.fileSystem.readFile(file);

        this.filesLoaded = true;
    }

    // Pull our text result out of the Jupyter cell
    private deserializeJupyterResult<T>(cells: ICell[]): T {
        // Verify that we have the correct cell type and outputs
        if (cells.length > 0 && cells[0].data) {
            const codeCell = cells[0].data as nbformat.ICodeCell;
            if (codeCell.outputs.length > 0) {
                const codeCellOutput = codeCell.outputs[0] as nbformat.IOutput;
                if (codeCellOutput && codeCellOutput.output_type === 'stream' && codeCellOutput.hasOwnProperty('text')) {
                   const resultString = codeCellOutput['text'] as string;
                   return JSON.parse(resultString) as T;
                }
            }
        }

        throw new Error(localize.DataScience.jupyterGetVariablesBadResults());
    }
}
