// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';

import { DataExplorerMessages, IDataExplorerMapping } from '../../client/datascience/data-viewing/types';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { generateTestData } from './testData';

import * as AdazzleReactDataGrid from 'react-data-grid';
import { Toolbar, Data } from 'react-data-grid-addons';
import { DataGridRowRenderer } from './dataGridRow';

const selectors = Data.Selectors;

const defaultColumnProperties = {
    filterable: true,
    sortable: true    
}
export interface IMainPanelProps {
    skipDefault?: boolean;
}

interface IMainPanelState {
    gridColumns: {key:string, name: string}[];
    gridRows: IGridRow[];
    initialGridRows: IGridRow[];
    filters:{};
}

interface IGridRow {
    [name: string] : any;
}

class DataExplorerPostOffice extends PostOffice<IDataExplorerMapping> {};

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private postOffice: DataExplorerPostOffice | undefined;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, state: IMainPanelState) {
        super(props);

        if (!this.props.skipDefault) {
            const data = generateTestData(5000);
            this.state = {
                gridColumns: data.columns,
                gridRows: data.rows,
                initialGridRows: data.rows,
                filters: {}
            };
        } else {
            this.state = {
                gridColumns: [],
                gridRows: [],
                initialGridRows: [],
                filters: {}
            };
        }
    }

    public render = () => {

        const filteredRows = this.getRows(this.state.gridRows, this.state.filters);
        
        return (
            <div className='main-panel'>
                <DataExplorerPostOffice messageHandlers={[this]} ref={this.updatePostOffice} />
                <div>Hello from React Data Grid</div>
                <AdazzleReactDataGrid
                    columns={this.state.gridColumns.map(c => { return {...c, ...defaultColumnProperties };})}
                    rowGetter={i => filteredRows[i]} 
                    rowsCount={filteredRows.length}
                    minHeight={300}
                    toolbar={<Toolbar enableFilter={true}/>}
                    rowRenderer={DataGridRowRenderer}
                    onAddFilter={filter => this.handleFilterChange(filter)}
                    onClearFilters={() => this.setState({filters: {}})}
                    onGridSort={(sortColumn: string, sortDirection: string) => this.sortRows(sortColumn, sortDirection)}
                />
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
