// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { JSONObject } from '@phosphor/coreutils';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import stripAnsi from 'strip-ansi';
import * as uuid from 'uuid/v4';

import { traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { Identifiers } from '../constants';
import { ICell, IHistoryProvider, IJupyterExecution, IJupyterVariable, IJupyterVariables } from '../types';

@injectable()
export class JupyterVariables implements IJupyterVariables {
    private fetchVariablesScript?: string;
    private fetchVariableValueScript?: string;
    private fetchDataFrameInfoScript?: string;
    private fetchDataFrameRowsScript?: string;
    private filesLoaded: boolean = false;

    constructor(
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IJupyterExecution) private jupyterExecution: IJupyterExecution,
        @inject(IHistoryProvider) private historyProvider: IHistoryProvider
    ) {
    }

    // IJupyterVariables implementation
    public async getVariables(): Promise<IJupyterVariable[]> {
        // Run the fetch variables script.
        return this.runScript<IJupyterVariable[]>(
            undefined,
            [],
            (_v: IJupyterVariable | undefined) => this.fetchVariablesScript!);
    }

    public async getValue(targetVariable: IJupyterVariable): Promise<IJupyterVariable> {
        // Run the get value script
        return this.runScript<IJupyterVariable>(
            targetVariable,
            targetVariable,
            (_v: IJupyterVariable | undefined) => {
                // Prep our targetVariable to send over
                const variableString = JSON.stringify(targetVariable);

                // Use just the name of the target variable to fetch the value
                return this.fetchVariableValueScript!.replace(/_VSCode_JupyterTestValue/g, variableString);
            });
    }

    public async getDataFrameInfo(targetVariable: IJupyterVariable): Promise<IJupyterVariable> {
        // Run the get dataframe info script
        return this.runScript<IJupyterVariable>(
            targetVariable,
            targetVariable,
            (_v: IJupyterVariable | undefined) => {
                // Prep our targetVariable to send over
                const variableString = JSON.stringify(targetVariable);

                // Use just the name of the target variable to fetch the data
                return this.fetchDataFrameInfoScript!.replace(/(_VSCode_JupyterTestValue)/g, variableString);
            });
    }

    public async getDataFrameRows(targetVariable: IJupyterVariable, start: number, end: number): Promise<JSONObject> {
        // Run the get dataframe rows script
        return this.runScript<JSONObject>(
            targetVariable,
            {},
            (_v: IJupyterVariable | undefined) => {
                // Prep our targetVariable to send over
                const variableString = JSON.stringify(targetVariable);

                // Replace the test value with our current value. Replace start and end as well
                return this.fetchDataFrameRowsScript!.replace(/_VSCode_JupyterTestValue|_VSCode_JupyterStartRow|_VSCode_JupyterEndRow/g, (match: string) => {
                    if (match === '_VSCode_JupyterTestValue') {
                        return variableString;
                    } else if (match === '_VSCode_JupyterStartRow') {
                        return start.toString();
                    } else if (match === '_VSCode_JupyterEndRow') {
                        return end.toString();
                    }

                    return match;
                });
            });
    }

    // Private methods
    // Load our python files for fetching variables
    private async loadVariableFiles(): Promise<void> {
        let file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableList.py');
        this.fetchVariablesScript = await this.fileSystem.readFile(file);

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableValue.py');
        this.fetchVariableValueScript = await this.fileSystem.readFile(file);

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableDataFrameInfo.py');
        this.fetchDataFrameInfoScript = await this.fileSystem.readFile(file);

        file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableDataFrameRows.py');
        this.fetchDataFrameRowsScript = await this.fileSystem.readFile(file);

        this.filesLoaded = true;
    }

    private async runScript<T>(
        targetVariable: IJupyterVariable | undefined,
        defaultValue: T,
        fetchScriptText: (v: IJupyterVariable | undefined) => string): Promise<T> {
        if (!this.filesLoaded) {
            await this.loadVariableFiles();
        }

        const activeServer = await this.jupyterExecution.getServer(await this.historyProvider.getNotebookOptions());
        if (!activeServer) {
            // No active server just return the unchanged target variable
            return defaultValue;
        }

        // Generate the new script text
        const scriptText = fetchScriptText(targetVariable);

        // Execute this on the jupyter server.
        const results = await activeServer.execute(scriptText, Identifiers.EmptyFileName, 0, uuid(), undefined, true);

        // Results should be the updated variable.
        return this.deserializeJupyterResult<T>(results);
    }

    // Pull our text result out of the Jupyter cell
    private deserializeJupyterResult<T>(cells: ICell[]): T {
        // Verify that we have the correct cell type and outputs
        if (cells.length > 0 && cells[0].data) {
            const codeCell = cells[0].data as nbformat.ICodeCell;
            if (codeCell.outputs.length > 0) {
                const codeCellOutput = codeCell.outputs[0] as nbformat.IOutput;
                if (codeCellOutput && codeCellOutput.output_type === 'stream' && codeCellOutput.hasOwnProperty('text')) {
                    const resultString = codeCellOutput.text as string;
                    return JSON.parse(resultString) as T;
                }
                if (codeCellOutput && codeCellOutput.output_type === 'error' && codeCellOutput.hasOwnProperty('traceback')) {
                    const traceback: string[] = codeCellOutput.traceback as string[];
                    const stripped = traceback.map(stripAnsi).join('\r\n');
                    const error = localize.DataScience.jupyterGetVariablesExecutionError().format(stripped);
                    traceError(error);
                    throw new Error(error);
                }
            }
        }

        throw new Error(localize.DataScience.jupyterGetVariablesBadResults());
    }
}
