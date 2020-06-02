// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './mainPanel.css';

import { JSONArray } from '@phosphor/coreutils';
import * as React from 'react';
import * as uuid from 'uuid/v4';

import {
    CellFetchAllLimit,
    CellFetchSizeFirst,
    CellFetchSizeSubsequent,
    ColumnType,
    DataViewerMessages,
    IDataFrameInfo,
    IDataViewerMapping,
    IGetRowsResponse,
    IRowsResponse
} from '../../client/datascience/data-viewing/types';
import { SharedMessages } from '../../client/datascience/messages';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import { getLocString, storeLocStrings } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { Progress } from '../react-common/progress';
import { StyleInjector } from '../react-common/styleInjector';
import { cellFormatterFunc } from './cellFormatter';
import { ISlickGridAdd, ISlickRow, ReactSlickGrid } from './reactSlickGrid';
import { generateTestData } from './testData';

// Our css has to come after in order to override body styles
export interface IMainPanelProps {
    skipDefault?: boolean;
    baseTheme: string;
    testMode?: boolean;
}

//tslint:disable:no-any
interface IMainPanelState {
    gridColumns: Slick.Column<Slick.SlickData>[];
    gridRows: ISlickRow[];
    fetchedRowCount: number;
    totalRowCount: number;
    filters: {};
    indexColumn: string;
    styleReady: boolean;
    settings?: IDataScienceExtraSettings;
}

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private container: React.Ref<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private sentDone = false;
    private postOffice: PostOffice = new PostOffice();
    private gridAddEvent: Slick.Event<ISlickGridAdd> = new Slick.Event<ISlickGridAdd>();
    private rowFetchSizeFirst: number = 0;
    private rowFetchSizeSubsequent: number = 0;
    private rowFetchSizeAll: number = 0;
    // Just used for testing.
    private grid: React.RefObject<ReactSlickGrid> = React.createRef<ReactSlickGrid>();
    private updateTimeout?: NodeJS.Timer | number;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);

        if (!this.props.skipDefault) {
            const data = generateTestData(5000);
            this.state = {
                gridColumns: data.columns.map((c) => {
                    return { ...c, formatter: cellFormatterFunc };
                }),
                gridRows: [],
                totalRowCount: data.rows.length,
                fetchedRowCount: -1,
                filters: {},
                indexColumn: data.primaryKeys[0],
                styleReady: false
            };

            // Fire off a timer to mimic dynamic loading
            setTimeout(() => this.handleGetAllRowsResponse(data.rows), 1000);
        } else {
            this.state = {
                gridColumns: [],
                gridRows: [],
                totalRowCount: 0,
                fetchedRowCount: -1,
                filters: {},
                indexColumn: 'index',
                styleReady: false
            };
        }
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the dataviewer code we have started.
        this.postOffice.sendMessage<IDataViewerMapping>(DataViewerMessages.Started);
    }

    public componentWillUnmount() {
        this.postOffice.removeHandler(this);
        this.postOffice.dispose();
    }

    public render = () => {
        if (!this.state.settings) {
            return <div className="main-panel" />;
        }

        // Send our done message if we haven't yet and we just reached full capacity. Do it here so we
        // can guarantee our render will run before somebody checks our rendered output.
        if (this.state.totalRowCount && this.state.totalRowCount === this.state.fetchedRowCount && !this.sentDone) {
            this.sentDone = true;
            this.sendMessage(DataViewerMessages.CompletedData);
        }

        const progressBar = this.state.totalRowCount > this.state.fetchedRowCount ? <Progress /> : undefined;

        return (
            <div className="main-panel" ref={this.container}>
                <StyleInjector
                    onReady={this.saveReadyState}
                    settings={this.state.settings}
                    expectingDark={this.props.baseTheme !== 'vscode-light'}
                    postOffice={this.postOffice}
                />
                {progressBar}
                {this.state.totalRowCount > 0 && this.state.styleReady && this.renderGrid()}
            </div>
        );
    };

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case DataViewerMessages.InitializeData:
                this.initializeData(payload);
                break;

            case DataViewerMessages.GetAllRowsResponse:
                this.handleGetAllRowsResponse(payload as IRowsResponse);
                break;

            case DataViewerMessages.GetRowsResponse:
                this.handleGetRowChunkResponse(payload as IGetRowsResponse);
                break;

            case SharedMessages.UpdateSettings:
                this.updateSettings(payload);
                break;

            case SharedMessages.LocInit:
                this.initializeLoc(payload);
                break;

            default:
                break;
        }

        return false;
    };

    private initializeLoc(content: string) {
        const locJSON = JSON.parse(content);
        storeLocStrings(locJSON);
    }

    private updateSettings(content: string) {
        const newSettingsJSON = JSON.parse(content);
        const newSettings = newSettingsJSON as IDataScienceExtraSettings;
        this.setState({
            settings: newSettings
        });
    }

    private saveReadyState = () => {
        this.setState({ styleReady: true });
    };

    private renderGrid() {
        const filterRowsText = getLocString('DataScience.filterRowsButton', 'Filter Rows');
        const filterRowsTooltip = getLocString('DataScience.filterRowsTooltip', 'Click to filter.');

        return (
            <ReactSlickGrid
                ref={this.grid}
                columns={this.state.gridColumns}
                idProperty={this.state.indexColumn}
                rowsAdded={this.gridAddEvent}
                filterRowsText={filterRowsText}
                filterRowsTooltip={filterRowsTooltip}
                forceHeight={this.props.testMode ? 200 : undefined}
            />
        );
    }

    // tslint:disable-next-line:no-any
    private initializeData(payload: any) {
        // Payload should be an IJupyterVariable with the first 100 rows filled out
        if (payload) {
            const variable = payload as IDataFrameInfo;
            if (variable) {
                const columns = this.generateColumns(variable);
                const totalRowCount = variable.rowCount ? variable.rowCount : 0;
                const initialRows: ISlickRow[] = [];
                const indexColumn = variable.indexColumn ? variable.indexColumn : 'index';

                this.setState({
                    gridColumns: columns,
                    gridRows: initialRows,
                    totalRowCount,
                    fetchedRowCount: initialRows.length,
                    indexColumn: indexColumn
                });

                // Compute our row fetch sizes based on the number of columns
                this.rowFetchSizeAll = Math.round(CellFetchAllLimit / columns.length);
                this.rowFetchSizeFirst = Math.round(Math.max(2, CellFetchSizeFirst / columns.length));
                this.rowFetchSizeSubsequent = Math.round(Math.max(2, CellFetchSizeSubsequent / columns.length));

                // Request the rest of the data if necessary
                if (initialRows.length !== totalRowCount) {
                    // Get all at once if less than 1000
                    if (totalRowCount < this.rowFetchSizeAll) {
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
        // Ask for our first chunk. Don't spam jupyter though with all requests at once
        // Instead, do them one at a time.
        const chunkEnd = startIndex + Math.min(this.rowFetchSizeFirst, endIndex);
        const chunkStart = startIndex;
        this.sendMessage(DataViewerMessages.GetRowsRequest, { start: chunkStart, end: chunkEnd });
    }

    private handleGetAllRowsResponse(response: IRowsResponse) {
        const rows = response ? (response as JSONArray) : [];
        const normalized = this.normalizeRows(rows);

        // Update our fetched count and actual rows
        this.setState({
            gridRows: this.state.gridRows.concat(normalized),
            fetchedRowCount: this.state.totalRowCount
        });

        // Add all of these rows to the grid
        this.updateRows(normalized);
    }

    private handleGetRowChunkResponse(response: IGetRowsResponse) {
        // We have a new fetched row count
        const rows = response.rows ? (response.rows as JSONArray) : [];
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
        this.updateRows(normalized);

        // Get the next chunk
        if (newFetched < this.state.totalRowCount) {
            const chunkStart = response.end;
            const chunkEnd = Math.min(chunkStart + this.rowFetchSizeSubsequent, this.state.totalRowCount);
            this.sendMessage(DataViewerMessages.GetRowsRequest, { start: chunkStart, end: chunkEnd });
        }
    }

    private generateColumns(variable: IDataFrameInfo): Slick.Column<Slick.SlickData>[] {
        if (variable.columns) {
            return variable.columns.map((c: { key: string; type: ColumnType }, i: number) => {
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

    private sendMessage<M extends IDataViewerMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }

    private updateRows(newRows: ISlickRow[]) {
        if (this.updateTimeout !== undefined) {
            clearTimeout(this.updateTimeout as any);
            this.updateTimeout = undefined;
        }
        if (!this.grid.current) {
            // This might happen before we render the grid. Postpone till then.
            this.updateTimeout = setTimeout(() => this.updateRows(newRows), 10);
        } else {
            this.gridAddEvent.notify({ newRows });
        }
    }
}
