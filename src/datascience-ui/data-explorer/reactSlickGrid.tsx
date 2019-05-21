
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {ReactSlickGridFilterBox} from './reactSlickGridFilterBox';

// Slickgrid requires jquery to be defined. Globally. So we do some hacks here.
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery!slickgrid/lib/jquery-1.11.2.min');
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery.fn.drag!slickgrid/lib/jquery.event.drag-2.3.0');

import 'slickgrid/slick.core';
import 'slickgrid/slick.dataview';
import 'slickgrid/slick.grid';

import 'slickgrid/slick.grid.css';
import './reactSlickGrid.css';


export interface ISlickGridProps {
    rows: Slick.SlickData[];
    idProperty: string;
    columns: Slick.Column<Slick.SlickData>[];
}

interface ISlickGridState {
    grid?: Slick.Grid<Slick.SlickData>;
    showingFilters?: boolean;
}

interface ISlickGridColumnFilter {
    text: string | undefined;
    column: Slick.Column<Slick.SlickData>;
}

export class ReactSlickGrid extends React.Component<ISlickGridProps, ISlickGridState> {
    private containerRef: React.RefObject<HTMLDivElement>;
    private dataView: Slick.Data.DataView<Slick.SlickData> = new Slick.Data.DataView();
    private columnFilters: Map<string, ISlickGridColumnFilter> = new Map<string, ISlickGridColumnFilter>();

    constructor(props: ISlickGridProps) {
        super(props);
        this.state = { };
        this.containerRef = React.createRef<HTMLDivElement>();
    }

    public componentDidMount = () => {
        if (this.containerRef.current) {
            // Setup options for the grid
            const options : Slick.GridOptions<Slick.SlickData> = {
                asyncEditorLoading: true,
                editable: false,
                enableCellNavigation: true,
                showHeaderRow: true,
                enableColumnReorder: false,
                explicitInitialization: true
            };

            // Create the grid
            const grid = new Slick.Grid<Slick.SlickData>(
                this.containerRef.current,
                this.dataView,
                this.props.columns,
                options
            );

            // Setup our dataview
            this.dataView.beginUpdate();
            this.dataView.setFilter(this.filter.bind(this));
            this.dataView.setItems(this.props.rows, this.props.idProperty);
            this.dataView.endUpdate();

            this.dataView.onRowCountChanged.subscribe((_e, _args) => {
                grid.updateRowCount();
                grid.render();
            });

            this.dataView.onRowsChanged.subscribe((_e, args) => {
                grid.invalidateRows(args.rows);
                grid.render();
            });

            // Setup the filter render
            grid.onHeaderRowCellRendered.subscribe(this.renderFilterCell);

            // Setup the sorting
            grid.onSort.subscribe(this.sort);

            // Init to force the actual render.
            grid.init();

            // Hide the header row after we fill it in.
            grid.setHeaderRowVisibility(false);

            // Save in our state
            this.setState({ grid });
        }
    }

    public componentWillUnmount = () => {
        if (this.state.grid) {
            this.state.grid.destroy();
        }
    }

    public componentDidUpdate = () => {
        if (this.state.showingFilters && this.state.grid) {
            this.state.grid.setHeaderRowVisibility(true);
        } else if (this.state.showingFilters === false && this.state.grid) {
            this.state.grid.setHeaderRowVisibility(false);
        }
    }

    public render() {
        return (
            <div className='outer-container'>
                <button onClick={this.clickFilterButton}>Filter</button>
                <div className='slickgrid-container' ref={this.containerRef}>
                </div>
            </div>
        );
    }

    // tslint:disable-next-line: no-any
    private filter(item: any, _args: any): boolean {
        const ids = Array.from(this.columnFilters.keys());
        for (const id of ids) {
            if (id) {
                const filter = this.columnFilters.get(id);
                if (filter) {
                    const actualText = item[id].toString();
                    if (actualText && !actualText.includes(filter.text)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private clickFilterButton = (e: React.SyntheticEvent) => {
        e.preventDefault();
        this.setState({showingFilters: !this.state.showingFilters});
    }

    private renderFilterCell = (_e: Slick.EventData, args: Slick.OnHeaderRowCellRenderedEventArgs<Slick.SlickData>) => {
        ReactDOM.render(<ReactSlickGridFilterBox column={args.column} onChange={this.filterChanged}/>, args.node);
    }

    private filterChanged = (text: string, column: Slick.Column<Slick.SlickData>) => {
        if (column && column.id) {
            this.columnFilters.set(column.id, { text, column });
            this.dataView.refresh();
        }
    }

    private sort = (_e: Slick.EventData, args: Slick.OnSortEventArgs<Slick.SlickData>) => {
        this.dataView.sort(this.dataSort, args.sortCol, args.sortAsc);
        args.grid.invalidateAllRows();
        args.grid.render();
    }
}
