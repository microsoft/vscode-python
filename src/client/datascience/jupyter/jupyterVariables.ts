// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Identifiers } from '../constants';
import { ICell, INotebookServer, INotebookServerManager, IJupyterVariable, IJupyterVariables } from '../types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { nbformat } from '@jupyterlab/coreutils';

@injectable()

export class JupyterVariables implements IJupyterVariables {
    private fetchVariablesFile: string | undefined;
    
    // IANHU: do we want to keep a reference here? What about when
    // the server is shutdown?
    private activeServer: INotebookServer | undefined;

    constructor(@inject(INotebookServerManager) private jupyterServerManager: INotebookServerManager) {
    }

    // IJupyterVariables implementation
    public async getVariables(): Promise<IJupyterVariable[]> {
        // First make sure our python file is loaded up
        // IANHU: Need 2.7 versus 3.X at this point?
        if (!this.fetchVariablesFile) {
            await this.loadVariablesFile();
        }

        // Next make sure that we have an active server
        if (!this.activeServer) {
            this.activeServer = await this.jupyterServerManager.getServer();

            // If we don't have a server here just return back an empty list
            if (!this.activeServer) {
                return [];
            }
        }

        // IANHU: Factor to sub-function 
        const results = await this.activeServer.execute(this.fetchVariablesFile, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
        const object = this.deserializeVariableData(results);

        return object;
    }

    public async getVariableShortInfo(targetVariable: IJupyterVariable): Promise<boolean> {
        return Promise.resolve(false);
    }

    // Private methods
    private async loadVariablesFile(): Promise<void> {
        if (this.fetchVariablesFile) {
            return;
        }

        const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getJupyterVariableList.py');
        this.fetchVariablesFile = await fs.readFile(file, 'utf-8');
    }

    private deserializeVariableData(cells: ICell[]): IJupyterVariable[] | undefined {
        // IANHU: This needs a better check here probably
        if (cells.length > 0 && cells[0].data.outputs[0]) {
            const output = cells[0].data.outputs[0] as nbformat.IOutput;

            if (output.data && output.data.hasOwnProperty('text/plain')) {
                // tslint:disable-next-line:no-any
                let resultString = ((output.data as any)['text/plain']);

                // Trim the excess ' character on the string
                resultString = resultString.slice(1, resultString.length - 1);

                const jsonObject: IJupyterVariable[] = JSON.parse(resultString) as IJupyterVariable[];
                return jsonObject;
            }
        }
    }
}