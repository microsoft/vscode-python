// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';

import { DataExplorerMessages, IDataExplorerMapping } from '../../client/datascience/data-viewing/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { generateTestData } from './testData';

import * as AdazzleReactDataGrid from 'react-data-grid';
import { Toolbar, Data } from 'react-data-grid-addons';

import 'bootstrap/dist/css/bootstrap.css'
import './mainPanel.css';

const selectors = Data.Selectors;

const defaultColumnProperties = {
    filterable: true,
    sortable: true,
    resizable: true,
    width: 120
}
export interface IMainPanelProps {
    skipDefault?: boolean;
}

interface IMainPanelState {
    gridColumns: {key:string, name: string}[];
    gridRows: IGridRow[];
    initialGridRows: IGridRow[];
    filters:{};
    gridHeight: number;
}

interface IGridRow {
    [name: string] : any;
}

class DataExplorerPostOffice extends PostOffice<IDataExplorerMapping> {};

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private postOffice: DataExplorerPostOffice | undefined;
    private container: HTMLDivElement | null = null;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, state: IMainPanelState) {
        super(props);

        if (!this.props.skipDefault) {
            const data = generateTestData(5000);
            this.state = {
                gridColumns: data.columns,
                gridRows: data.rows,
                initialGridRows: data.rows,
                filters: {},
                gridHeight: 100
            };
        } else {
            this.state = {
                gridColumns: [],
                gridRows: [],
                initialGridRows: [],
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

        const maxStyle: React.CSSProperties = {
            position: 'absolute',
            bottom: '0',
            top: '0px',
            left: '0px',
            right: '0'
        };

        return (
            <div className='main-panel' style={maxStyle} ref={el => this.container = el}>
                <DataExplorerPostOffice messageHandlers={[this]} ref={this.updatePostOffice} />
                {this.container && this.renderGrid()}
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            default:
                break;
        }

        return false;
    }

    private updateDimensions = () => {
        if (this.container) {
            const height = this.container.offsetHeight;
            this.setState({gridHeight: height -100});
        }
    }

    private renderGrid() {
        const filteredRows = this.getRows(this.state.gridRows, this.state.filters);
        return(
        <AdazzleReactDataGrid
            columns={this.state.gridColumns.map(c => { return {...c, ...defaultColumnProperties };})}
            rowGetter={i => filteredRows[i]} 
            rowsCount={filteredRows.length}
            minHeight={this.state.gridHeight}
            toolbar={<Toolbar enableFilter={true}/>}
            onAddFilter={filter => this.handleFilterChange(filter)}
            onClearFilters={() => this.setState({filters: {}})}
            onGridSort={(sortColumn: string, sortDirection: string) => this.sortRows(sortColumn, sortDirection)}
        />
        );
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
        const newFilters: {[key: string] : any } = { ...this.state.filters };
        if (filter.column.key) {
            if (filter.filterTerm) {
                newFilters[filter.column.key] = filter;
            } else {
                delete newFilters[filter.column.key];
            }
        }
        this.setState({filters: newFilters});
      };
      
      private getRows(rows: any, filters: any) {
        return selectors.getRows({ rows, filters });
      }
      
      private sortRows = (sortColumn: string | number, sortDirection: string) => {
        if (sortDirection === 'NONE') {
            sortColumn = 'index';
            sortDirection = 'ASC';
        }
        const comparer = (a: IGridRow, b: IGridRow) : number =>  {
          if (sortDirection === "ASC") {
            return a[sortColumn] > b[sortColumn] ? 1 : -1;
          } else if (sortDirection === "DESC") {
            return a[sortColumn] < b[sortColumn] ? 1 : -1;
          }
          return -1;
        };
        const sorted = this.state.initialGridRows.sort(comparer);
        this.setState({gridRows: sorted});
      };

}
