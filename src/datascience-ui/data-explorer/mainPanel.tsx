// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './mainPanel.css';

import { JSONArray, JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import * as AdazzleReactDataGrid from 'react-data-grid';
import { Data, Toolbar } from 'react-data-grid-addons';

import {
    DataExplorerMessages,
    DataExplorerRowStates,
    IDataExplorerMapping,
    IGetRowsResponse,
    RowFetchAllLimit,
    RowFetchSizeFirst,
    RowFetchSizeSubsequent
} from '../../client/datascience/data-viewing/types';
import { IJupyterVariable } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { CellFormatter } from './cellFormatter';
import { EmptyRowsView } from './emptyRowsView';
import { generateTestData } from './testData';

import 'bootstrap/dist/css/bootstrap.css';

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
    sortDirection: string;
    sortColumn: string | number;
}

class DataExplorerPostOffice extends PostOffice<IDataExplorerMapping> { }

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private postOffice: DataExplorerPostOffice | undefined;
    private container: HTMLDivElement | null = null;
    private emptyRows: (() => JSX.Element) | undefined;
    private getEmptyRows: ((props: any) => JSX.Element) | undefined;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);

        if (!this.props.skipDefault) {
            const data = generateTestData(5000);
            const rows = this.padRows(data.rows, data.rows.length + 100);
            this.state = {
                gridColumns: data.columns.map(c => { return { ...c, ...defaultColumnProperties, formatter: CellFormatter, getRowMetaData: this.getRowMetaData.bind(this) }; }),
                currentGridRows: rows,
                actualGridRows: rows,
                actualRowCount: data.rows.length + 100,
                fetchedRowCount: data.rows.length,
                filters: {},
                gridHeight: 100,
                sortColumn: 'index',
                sortDirection: 'NONE'
            };
        } else {
            this.state = {
                gridColumns: [],
                currentGridRows: [],
                actualGridRows: [],
                actualRowCount: 0,
                fetchedRowCount: 0,
                filters: {},
                gridHeight: 100,
                sortColumn: 'index',
                sortDirection: 'NONE'
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

    public componentDidUpdate() {
        // Rebind our empty rows view to our new state.
        this.emptyRows = EmptyRowsView.bind(this, {current: this.state.fetchedRowCount, total: this.state.actualRowCount});
        this.getEmptyRows = (_props: any) => {
            return this.emptyRows ? this.emptyRows() : <div/>;
        };
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

            case DataExplorerMessages.GetAllRowsResponse:
                this.handleGetAllRowsResponse(payload as JSONObject);
                break;

            case DataExplorerMessages.GetRowsResponse:
                this.handleGetRowChunkResponse(payload as IGetRowsResponse);
                break;

            default:
                break;
        }

        return false;
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
                emptyRowsView={this.getEmptyRows}
                onGridSort={this.sortRows}
            />
        );
    }

    // tslint:disable-next-line:no-any
    private initializeData(payload: any) {
        // Payload should be an IJupyterVariable with the first 100 rows filled out
        if (payload) {
            const variable = payload as IJupyterVariable;
            if (variable) {
                const columns = this.generateColumns(variable);
                const totalRowCount = variable.rowCount ? variable.rowCount : 0;
                const initialRows: JSONArray = [];
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

                // Request the rest of the data if necessary
                if (initialRows.length !== totalRowCount) {
                    // Get all at once if less than 1000
                    if (totalRowCount < RowFetchAllLimit) {
                        this.getAllRows();
                    } else {
                        this.getRowsInChunks(initialRows.length, totalRowCount);
                    }
                }
            }
        }
    }

    private getAllRows() {
        this.sendMessage(DataExplorerMessages.GetAllRowsRequest);
    }

    private getRowsInChunks(startIndex: number, endIndex: number) {
        // Ask for all of our rows one chunk at a time
        let chunkEnd = startIndex + Math.min(RowFetchSizeFirst, endIndex);
        let chunkStart = startIndex;
        while (chunkStart < endIndex) {
            this.sendMessage(DataExplorerMessages.GetRowsRequest, {start: chunkStart, end: chunkEnd});
            chunkStart = chunkEnd;
            chunkEnd = Math.min(chunkEnd + RowFetchSizeSubsequent, endIndex);
        }
    }

    private handleGetAllRowsResponse(response: JSONObject) {
        const rows = response.data ? response.data as JSONArray : [];

        // Update our fetched count and actual rows
        this.setState(
            {
                actualGridRows: rows,
                currentGridRows: this.getSortedAndFilteredRows(rows, this.state.sortDirection, this.state.sortColumn, this.state.filters),
                fetchedRowCount: this.state.actualRowCount
            });
    }

    private handleGetRowChunkResponse(response: IGetRowsResponse) {
        // We have a new fetched row count
        const rows = response.rows.data ? response.rows.data as JSONArray : [];
        const newFetched = this.state.fetchedRowCount + (response.end - response.start);

        // Actual should have our entire list. We need to replace our part with our new results
        const before = this.state.actualGridRows.slice(0, response.start);
        const after = response.end < this.state.actualGridRows.length ? this.state.actualGridRows.slice(response.end) : [];
        const newActual = before.concat(rows.concat(after));

        // If we're done, sort and filter
        if (newFetched === this.state.actualRowCount) {
            this.setState({
                fetchedRowCount: newFetched,
                currentGridRows: this.getSortedAndFilteredRows(newActual, this.state.sortDirection, this.state.sortColumn, this.state.filters),
                actualGridRows: newActual
            });
        } else if (this.state.currentGridRows.length > 0) {
            // If we're not sorting or filtering, then we can just set to the default
            this.setState({
                fetchedRowCount: newFetched,
                currentGridRows: newActual,
                actualGridRows: newActual
            });
        } else {
            // Just update our actual
            this.setState({
                fetchedRowCount: newFetched,
                actualGridRows: newActual
            });
        }
    }

    private padRows(initialRows: any[], wantedCount: number) : any[] {
        if (wantedCount > initialRows.length) {
            const fetching : string[] = Array<string>(wantedCount - initialRows.length).fill(DataExplorerRowStates.Fetching);
            return [...initialRows, ...fetching];
        }
        return initialRows;
    }

    private generateColumns(variable: IJupyterVariable): AdazzleReactDataGrid.Column<object>[]  {
        if (variable.columns) {
            return variable.columns.map((c: {key: string; type: string}, i: number) => {
                return {
                    ...c,
                    index: i,
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

    private updateDimensions = () => {
        if (this.container) {
            const height = this.container.offsetHeight;
            this.setState({ gridHeight: height - 100 });
        }
    }

    private updateContainer = (el: HTMLDivElement) => {
        this.container = el;
    }

    private getRowCount = () => {
        // Current grid rows always specifies what we show.
        return this.state.currentGridRows.length;
    }

    private getRow = (index: number) => {
        return this.state.currentGridRows[index];
    }

    private haveAllRows(): boolean {
        return (this.state.fetchedRowCount === this.state.actualRowCount);
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

    private getSortedAndFilteredRows(rows: JSONArray, sortDirection: string, sortColumn: string | number, filters: {}) : any[] {
        // First apply sort
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
        const sorted = rows.sort(comparer);

        // Then apply the filters.
        return selectors.getRows({rows: sorted, filters});
    }

    // tslint:disable:no-any
    private handleFilterChange = (filter: any) => {
        // Generate new filters.
        const newFilters: { [key: string]: any } = { ...this.state.filters };
        if (filter.column.key) {
            if (filter.filterTerm) {
                newFilters[filter.column.key] = filter;
            } else {
                delete newFilters[filter.column.key];
            }
        }

        // Make sure we have all rows. If not, clear our current list
        if (!this.haveAllRows()) {
            // Just save the filters.
            this.setState({ filters: newFilters, currentGridRows: [] });
        } else {
            // We have all rows, filter them.
            this.setState({
                filters: newFilters,
                currentGridRows: this.getSortedAndFilteredRows(
                    this.state.actualGridRows, this.state.sortDirection, this.state.sortColumn, newFilters)
            });
        }
    }

    private clearFilters = () => {
        // Make sure we have all rows. If not, clear our current list
        if (!this.haveAllRows()) {
            // Just save the filters.
            this.setState({ filters: {}, currentGridRows: [] });
        } else {
            // We have all rows, filter them.
            this.setState({
                filters: {},
                currentGridRows: this.getSortedAndFilteredRows(
                    this.state.actualGridRows, this.state.sortDirection, this.state.sortColumn, {})
            });
        }
    }

    private sortRows = (sortColumn: string | number, sortDirection: string) => {
        // Make sure we have all rows. If not, clear our current list
        if (!this.haveAllRows()) {
            // Just save the sort direction/column
            this.setState({ sortColumn, sortDirection, currentGridRows: [] });
        } else {
            // We have all rows, sort them.
            this.setState({
                sortColumn,
                sortDirection,
                currentGridRows: this.getSortedAndFilteredRows(
                    this.state.actualGridRows, sortDirection, sortColumn, this.state.filters)
            });
        }
    }

}
