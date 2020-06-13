// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, named } from 'inversify';

import { Identifiers } from '../constants';
import { IJupyterVariable, IJupyterVariableDataProvider, IJupyterVariables, INotebook } from '../types';
import { DataViewerDependencyService } from './dataViewerDependencyService';
import { ColumnType, IDataFrameInfo, IRowsResponse } from './types';

@injectable()
export class JupyterVariableDataProvider implements IJupyterVariableDataProvider {
    private initialized: boolean = false;
    private notebook: INotebook | undefined;
    private variable: IJupyterVariable | undefined;

    constructor(
        @inject(IJupyterVariables) @named(Identifiers.ALL_VARIABLES) private variableManager: IJupyterVariables,
        @inject(DataViewerDependencyService) private dependencyService: DataViewerDependencyService
    ) {}

    /**
     * Normalizes column types to the types the UI component understands.
     * Defaults to 'string'.
     * @param columns
     * @returns Array of columns with normalized type
     */
    private static getNormalizedColumns(columns: { key: string; type: string }[]): { key: string; type: ColumnType }[] {
        return columns.map((column: { key: string; type: string }) => {
            let normalizedType: ColumnType;
            switch (column.type) {
                case 'bool':
                    normalizedType = ColumnType.Bool;
                    break;
                case 'integer':
                case 'int32':
                case 'int64':
                case 'float':
                case 'float32':
                case 'float64':
                case 'number':
                    normalizedType = ColumnType.Number;
                    break;
                default:
                    normalizedType = ColumnType.String;
            }
            return {
                key: column.key,
                type: normalizedType
            };
        });
    }

    public dispose(): void {
        return;
    }

    public setDependencies(variable: IJupyterVariable, notebook: INotebook): void {
        this.notebook = notebook;
        this.variable = variable;
    }

    public async getDataFrameInfo(): Promise<IDataFrameInfo> {
        let dataFrameInfo: IDataFrameInfo = {};
        await this.ensureInitialized();
        if (this.variable && this.notebook) {
            dataFrameInfo = {
                columns: this.variable.columns
                    ? JupyterVariableDataProvider.getNormalizedColumns(this.variable.columns)
                    : this.variable.columns,
                indexColumn: this.variable.indexColumn,
                rowCount: this.variable.rowCount
            };
        }
        return dataFrameInfo;
    }

    public async getAllRows() {
        let allRows: IRowsResponse = [];
        await this.ensureInitialized();
        if (this.variable && this.variable.rowCount && this.notebook) {
            const dataFrameRows = await this.variableManager.getDataFrameRows(
                this.variable,
                this.notebook,
                0,
                this.variable.rowCount
            );
            allRows = dataFrameRows && dataFrameRows.data ? (dataFrameRows.data as IRowsResponse) : [];
        }
        return allRows;
    }

    public async getRows(start: number, end: number) {
        let rows: IRowsResponse = [];
        await this.ensureInitialized();
        if (this.variable && this.variable.rowCount && this.notebook) {
            const dataFrameRows = await this.variableManager.getDataFrameRows(this.variable, this.notebook, start, end);
            rows = dataFrameRows && dataFrameRows.data ? (dataFrameRows.data as IRowsResponse) : [];
        }
        return rows;
    }

    private async ensureInitialized(): Promise<void> {
        // Postpone pre-req and variable initialization until data is requested.
        if (!this.initialized && this.variable && this.notebook) {
            this.initialized = true;
            await this.dependencyService.checkAndInstallMissingDependencies(this.notebook.getMatchingInterpreter());
            this.variable = await this.variableManager.getDataFrameInfo(this.variable, this.notebook);
        }
    }
}
