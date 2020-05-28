// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, named } from 'inversify';

import { JSONObject } from '@phosphor/coreutils';

import { Identifiers } from '../constants';
import { IJupyterVariable, IJupyterVariableDataProvider, IJupyterVariables, INotebook } from '../types';
import { DataViewerDependencyService } from './dataViewerDependencyService';
import { ColumnType, IDataFrameInfo } from './types';

@injectable()
export class JupyterVariableDataProvider implements IJupyterVariableDataProvider {
    private initialized: boolean = false;

    constructor(
        @inject(IJupyterVariables) @named(Identifiers.ALL_VARIABLES) private variableManager: IJupyterVariables,
        @inject(DataViewerDependencyService) private dependencyService: DataViewerDependencyService,
        private variable: IJupyterVariable,
        private notebook: INotebook
    ) {}

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

    public async getDataFrameInfo(): Promise<IDataFrameInfo> {
        await this.ensureInitialized();
        return {
            columns: this.variable.columns
                ? JupyterVariableDataProvider.getNormalizedColumns(this.variable.columns)
                : this.variable.columns,
            indexColumn: this.variable.indexColumn,
            rowCount: this.variable.rowCount || 0
        };
    }

    public async getAllRows() {
        let allRows: JSONObject = {};
        await this.ensureInitialized();
        if (this.variable.rowCount) {
            allRows = await this.variableManager.getDataFrameRows(
                this.variable,
                this.notebook,
                0,
                this.variable.rowCount
            );
        }
        return allRows;
    }

    public async getRows(start: number, end: number) {
        let rows: JSONObject = {};
        await this.ensureInitialized();
        if (this.variable.rowCount) {
            rows = await this.variableManager.getDataFrameRows(this.variable, this.notebook, start, end);
        }
        return rows;
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.dependencyService.checkAndInstallMissingDependencies(this.notebook.getMatchingInterpreter());
            this.variable = await this.variableManager.getDataFrameInfo(this.variable, this.notebook);
            this.initialized = true;
        }
    }
}
