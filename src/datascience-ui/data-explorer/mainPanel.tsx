// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { JSONArray, JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import * as uuid from 'uuid/v4';

import {
    DataViewerMessages,
    IDataViewerMapping,
    IGetRowsResponse,
    RowFetchAllLimit,
    RowFetchSizeFirst,
    RowFetchSizeSubsequent
} from '../../client/datascience/data-viewing/types';
import { IJupyterVariable } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { StyleInjector } from '../react-common/styleInjector';
import { cellFormatterFunc } from './cellFormatter';
import { ISlickGridAdd, ISlickRow, ReactSlickGrid } from './reactSlickGrid';
import { generateTestData } from './testData';

// Our css has to come after in order to override body styles
import './mainPanel.css';

export interface IMainPanelProps {
    skipDefault?: boolean;
    forceHeight?: number;
    baseTheme: string;
}

//tslint:disable:no-any
interface IMainPanelState {
    gridColumns: Slick.Column<Slick.SlickData>[];
    gridRows: ISlickRow[];
    fetchedRowCount: number;
    totalRowCount: number;
    filters: {};
    gridHeight: number;
    sortDirection: string;
    sortColumn: string | number;
    indexColumn: string;
}

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private container: HTMLDivElement | null = null;
    private sentDone = false;
    private postOffice: PostOffice = new PostOffice();
    private gridAddEvent: Slick.Event<ISlickGridAdd> = new Slick.Event<ISlickGridAdd>();

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);

        if (!this.props.skipDefault) {
            const data = generateTestData(5000);
            this.state = {
                gridColumns: data.columns.map(c => { return {...c, formatter: cellFormatterFunc }; }),
                gridRows: [],
                totalRowCount: data.rows.length,
                fetchedRowCount: 0,
                filters: {},
                gridHeight:  100,
                sortColumn: 'index',
                sortDirection: 'NONE',
                indexColumn: data.primaryKeys[0]
            };

            // Fire off a timer to mimic dynamic loading
            setTimeout(() => {
                this.handleGetAllRowsResponse({data: data.rows});
            }, 1000);
        } else {
            this.state = {
                gridColumns: [],
                gridRows: [],
                totalRowCount: 0,
                fetchedRowCount: 0,
                filters: {},
                gridHeight: 100,
                sortColumn: 'index',
                sortDirection: 'NONE',
                indexColumn: 'index'
            };
        }
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the dataviewer code we have started.
        this.postOffice.sendMessage<IDataViewerMapping, 'started'>(DataViewerMessages.Started);
    }

    public componentWillUnmount() {
        this.postOffice.removeHandler(this);
        this.postOffice.dispose();
    }

    public render = () => {
        // Send our done message if we haven't yet and we just reached full capacity. Do it here so we
        // can guarantee our render will run before somebody checks our rendered output.
        if (this.state.totalRowCount && this.state.totalRowCount === this.state.fetchedRowCount && !this.sentDone) {
            this.sentDone = true;
            this.sendMessage(DataViewerMessages.CompletedData);
        }

        return (
            <div className='main-panel' ref={this.updateContainer}>
                <StyleInjector
                    expectingDark={this.props.baseTheme !== 'vscode-light'}
                    postOffice={this.postOffice} />
                {this.container && this.state.totalRowCount > 0 && this.renderGrid()}
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case DataViewerMessages.InitializeData:
                this.initializeData(payload);
                break;

            case DataViewerMessages.GetAllRowsResponse:
                this.handleGetAllRowsResponse(payload as JSONObject);
                break;

            case DataViewerMessages.GetRowsResponse:
                this.handleGetRowChunkResponse(payload as IGetRowsResponse);
                break;

            default:
                break;
        }

        return false;
    }

    private renderGrid() {
        return (
            <ReactSlickGrid
                columns={this.state.gridColumns}
                idProperty={this.state.indexColumn}
                rowsAdded={this.gridAddEvent}
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
                const initialRows: ISlickRow[] = [];
                const indexColumn = variable.indexColumn ? variable.indexColumn : 'index';

                this.setState(
                    {
                        gridColumns: columns,
                        gridRows: initialRows,
                        totalRowCount,
                        fetchedRowCount: initialRows.length,
                        indexColumn: indexColumn
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
        this.sendMessage(DataViewerMessages.GetAllRowsRequest);
    }

    private getRowsInChunks(startIndex: number, endIndex: number) {
        // Ask for all of our rows one chunk at a time
        let chunkEnd = startIndex + Math.min(RowFetchSizeFirst, endIndex);
        let chunkStart = startIndex;
        while (chunkStart < endIndex) {
            this.sendMessage(DataViewerMessages.GetRowsRequest, {start: chunkStart, end: chunkEnd});
            chunkStart = chunkEnd;
            chunkEnd = Math.min(chunkEnd + RowFetchSizeSubsequent, endIndex);
        }
    }

    private handleGetAllRowsResponse(response: JSONObject) {
        const rows = response.data ? response.data as JSONArray : [];
        const normalized = this.normalizeRows(rows);

        // Update our fetched count and actual rows
        this.setState(
            {
                gridRows: this.state.gridRows.concat(normalized),
                fetchedRowCount: this.state.totalRowCount
            });

        // Add all of these rows to the grid
        this.gridAddEvent.notify({newRows: normalized});
    }

    private handleGetRowChunkResponse(response: IGetRowsResponse) {
        // We have a new fetched row count
        const rows = response.rows.data ? response.rows.data as JSONArray : [];
        const normalized = this.normalizeRows(rows);
        const newFetched = this.state.fetchedRowCount + (response.end - response.start);

        // gridRows should have our entire list. We need to replace our part with our new results
        const before = this.state.gridRows.slice(0, response.start);
        const after = response.end < this.state.gridRows.length ? this.state.gridRows.slice(response.end) : [];
        const newActual = before.concat(normalized.concat(after));

        // Apply this to our state
        this.setState({
            fetchedRowCount: newFetched,
            gridRows: newActual
        });

        // Tell our grid about the new ros
        this.gridAddEvent.notify({newRows: normalized});
    }

    private generateColumns(variable: IJupyterVariable): Slick.Column<Slick.SlickData>[]  {
        if (variable.columns) {
            return variable.columns.map((c: {key: string; type: string}, i: number) => {
                return {
                    type: c.type,
                    field: c.key.toString(),
                    id: `${i}`,
                    name: c.key.toString(),
                    sortable: true,
                    formatter: cellFormatterFunc
                };
            });
        }
        return [];
    }

    private normalizeRows(rows: JSONArray): ISlickRow[] {
        // Make sure we have an index field and all rows have an item
        return rows.map((r: any | undefined) => {
            if (!r) {
                r = {};
            }
            if (!r.hasOwnProperty(this.state.indexColumn)) {
                r[this.state.indexColumn] = uuid();
            }
            return r;
        });
    }

    private updateContainer = (el: HTMLDivElement) => {
        this.container = el;
    }

    private sendMessage<M extends IDataViewerMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }

}
