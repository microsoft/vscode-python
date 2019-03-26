// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './mainPanel.css';
import 'bootstrap/dist/css/bootstrap.css';

import * as React from 'react';
import * as AdazzleReactDataGrid from 'react-data-grid';
import { Data, Toolbar } from 'react-data-grid-addons';

import {
    DataExplorerMessages,
    DataExplorerRowStates,
    IDataExplorerMapping,
    RowFetchPreAmount,
    RowFetchSize
} from '../../client/datascience/data-viewing/types';
import { IJupyterVariable } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { CellFormatter } from './cellFormatter';
import { generateTestData } from './testData';

const selectors = Data.Selectors;

const defaultColumnProperties = {
    filterable: true,
    sortable: true,
    resizable: true,
    width: 120
};

export interface IMainPanelProps {
    skipDefault?: boolean;
}

//tslint:disable:no-any
interface IMainPanelState {
    gridColumns: AdazzleReactDataGrid.Column<any>[];
    currentGridRows: any[];
    actualGridRows: any[];
    fetchedRowCount: number;
    actualRowCount: number;
    filters: {};
    gridHeight: number;
}

class DataExplorerPostOffice extends PostOffice<IDataExplorerMapping> { }

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private postOffice: DataExplorerPostOffice | undefined;
    private container: HTMLDivElement | null = null;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);

        if (!this.props.skipDefault) {
            const data = generateTestData(5000);
            this.state = {
                gridColumns: data.columns.map(c => { return { ...c, ...defaultColumnProperties, formatter: CellFormatter, getRowMetaData: this.getRowMetaData.bind(this) }; }),
                currentGridRows: data.rows,
                actualGridRows: data.rows,
                actualRowCount: data.rows.length,
                fetchedRowCount: data.rows.length,
                filters: {},
                gridHeight: 100
            };
        } else {
            this.state = {
                gridColumns: [],
                currentGridRows: [],
                actualGridRows: [],
                actualRowCount: 0,
                fetchedRowCount: 0,
                filters: {},
                gridHeight: 100
            };
        }
    }

    public componentDidMount() {
        window.addEventListener('resize', this.updateDimensions);
        this.updateDimensions();
    }

    public componentWillUnmount() {
        window.removeEventListener('resize', this.updateDimensions);
    }

    public render = () => {

        return (
            <div className='main-panel' ref={this.updateContainer}>
                <DataExplorerPostOffice messageHandlers={[this]} ref={this.updatePostOffice} />
                {this.container && this.renderGrid()}
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case DataExplorerMessages.InitializeData: 
                this.initializeData(payload);
                break;
            default:
                break;
        }

        return false;
    }

    // tslint:disable-next-line:no-any
    private initializeData(payload: any) {
        // Payload should be an IJupyterVariable with the first 100 rows filled out
        if (payload) {
            const variable = payload as IJupyterVariable;
            if (variable) {
                const columns = this.generateColumns(variable);
                const totalRowCount = variable.rowCount ? variable.rowCount : 0;
                const initialRows = this.generateRows(variable);
                const paddedRows = this.padRows(initialRows, totalRowCount);

                this.setState(
                    {
                        gridColumns: columns,
                        actualGridRows: paddedRows,
                        currentGridRows: paddedRows,
                        actualRowCount: totalRowCount,
                        fetchedRowCount: initialRows.length
                    }
                );
            }
        }
    }

    private padRows(initialRows: any[], wantedCount: number) : any[] {
        if (wantedCount > initialRows.length) {
            const skipped : string[] = Array<string>(wantedCount - initialRows.length);
            return [...initialRows, ...skipped];
        }
        return initialRows;
    }

    private generateColumns(variable: IJupyterVariable): AdazzleReactDataGrid.Column<object>[]  {
        if (variable.columns) {
            return variable.columns.map(c => {
                return {
                    ...c,
                    name: c.key,
                    ...defaultColumnProperties,
                    formatter: CellFormatter,
                    getRowMetaData: this.getRowMetaData.bind(this)
                }; 
            });
        }
        return [];
    }

    private getRowMetaData(_row: object, column?: AdazzleReactDataGrid.Column<object>): any {
        if (column) {
            const obj = column as any;
            if (obj.type) {
                return obj.type.toString();
            }
        }
        return '';
    }

    // tslint:disable-next-line:no-any
    private generateRows(variable: IJupyterVariable): any[] {
        if (variable.rows) {
            return variable.rows;
        }
        return [];
    }

    private updateDimensions = () => {
        if (this.container) {
            const height = this.container.offsetHeight;
            this.setState({ gridHeight: height - 100 });
        }
    }

    private updateContainer = (el: HTMLDivElement) => {
        this.container = el;
    }

    private renderGrid() {
        const rowCount = this.getRowCount();

        return (
            <AdazzleReactDataGrid
                columns={this.state.gridColumns}
                rowGetter={this.getRow}
                rowsCount={rowCount}
                minHeight={this.state.gridHeight}
                toolbar={<Toolbar enableFilter={true} />}
                onAddFilter={this.handleFilterChange}
                onClearFilters={this.clearFilters}
                onGridSort={this.sortRows}
            />
        );
    }

    private getRowCount = () => {
        // If we have all of our data, then it's the filtered rows count
        if (this.state.actualRowCount === this.state.fetchedRowCount) {
            return this.state.currentGridRows.length;
        }

        // Otherwise it's the number fetched
        return this.state.fetchedRowCount;
    }

    private getRow = (index: number) => {
        // This might be outside of our array of data
        if (index >= this.state.fetchedRowCount && this.state.currentGridRows[index] === DataExplorerRowStates.Skipped) {

            // Figure out start point for the fetch
            const start = Math.max(index - RowFetchPreAmount, 0);
            this.fetchRows(start);
        }

        return this.state.currentGridRows[index];
    }

    private fetchRows(start: number) {
        // First compute the end point for this. Should be
        // maxed out the total length
        const end = Math.min(this.state.actualRowCount, start + RowFetchSize);

        // Change all of our current grid rows in this range to fetching
        const newGridRows = this.state.actualGridRows.map((c: any, i: number) => {
            if (i < end && i >= start && c === DataExplorerRowStates.Skipped) {
                return DataExplorerRowStates.Fetching;
            }
            return c;
        });
        this.setState({
            actualGridRows: newGridRows,
            currentGridRows: newGridRows,
            fetchedRowCount: this.state.fetchedRowCount + (end - start)
        });

        // Actually perform the fetch (we'll get back a GetRowsResponse when it's done)
        this.sendMessage(DataExplorerMessages.GetRowsRequest, {start, end});
    }

    private getAllRows() {
        // This will get called when we sort or filter if we don't have all of our data
        if (this.state.fetchedRowCount !== this.state.actualRowCount) {
            // First set our message to our fetching data message by removing all rows
            this.setState({
                fetchedRowCount: 0
            });

            // Then ask for all of the rows
            this.sendMessage(DataExplorerMessages.GetAllRowsRequest);
        }
    }

    private updatePostOffice = (postOffice: DataExplorerPostOffice) => {
        if (this.postOffice !== postOffice) {
            this.postOffice = postOffice;
            this.sendMessage(DataExplorerMessages.Started);
        }
    }

    private sendMessage<M extends IDataExplorerMapping, T extends keyof M>(type: T, payload?: M[T]) {
        if (this.postOffice) {
            this.postOffice.sendMessage(type, payload);
        }
    }

    // tslint:disable:no-any
    private handleFilterChange = (filter: any) => {
        // Make sure we have all rows
        this.getAllRows();

        // Then apply the filters
        const newFilters: { [key: string]: any } = { ...this.state.filters };
        if (filter.column.key) {
            if (filter.filterTerm) {
                newFilters[filter.column.key] = filter;
            } else {
                delete newFilters[filter.column.key];
            }
        }
        this.setState({ filters: newFilters, currentGridRows: selectors.getRows({rows: this.state.actualGridRows, filters: newFilters})});
    }

    private clearFilters = () => {
        this.setState({ filters: {} });
    }

    private sortRows = (sortColumn: string | number, sortDirection: string) => {
        // Make sure we have all rows
        this.getAllRows();

        // Then apply the sort
        if (sortDirection === 'NONE') {
            sortColumn = 'index';
            sortDirection = 'ASC';
        }
        const comparer = (a: any, b: any): number => {
            if (typeof a !== 'string' && typeof b !== 'string') {
                if (sortDirection === 'ASC') {
                    return a[sortColumn] > b[sortColumn] ? 1 : -1;
                } else if (sortDirection === 'DESC') {
                    return a[sortColumn] < b[sortColumn] ? 1 : -1;
                }
            }
            return -1;
        };
        const sorted = this.state.actualGridRows.sort(comparer);
        this.setState({ currentGridRows: selectors.getRows({rows: sorted, filters: this.state.filters}) });
    }

}
