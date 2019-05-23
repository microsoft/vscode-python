
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { MaxStringCompare } from '../../client/datascience/data-viewing/types';
import { ReactSlickGridFilterBox } from './reactSlickGridFilterBox';

// Slickgrid requires jquery to be defined. Globally. So we do some hacks here.
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery!slickgrid/lib/jquery-1.11.2.min');
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery.fn.drag!slickgrid/lib/jquery.event.drag-2.3.0');

import 'slickgrid/slick.core';
import 'slickgrid/slick.dataview';
import 'slickgrid/slick.grid';

import 'slickgrid/slick.grid.css';

// Make sure our css comes after the slick grid css. We override some of its styles.
import './reactSlickGrid.css';

export interface ISlickRow extends Slick.SlickData {
    id: string;
}

export interface ISlickGridAdd {
    newRows: ISlickRow[];
}

// tslint:disable:no-any
export interface ISlickGridProps {
    idProperty: string;
    columns: Slick.Column<ISlickRow>[];
    rowsAdded: Slick.Event<ISlickGridAdd>;
}

interface ISlickGridState {
    grid?: Slick.Grid<ISlickRow>;
    showingFilters?: boolean;
    fontSize: number;
}

interface ISlickGridColumnFilter {
    text: string | undefined;
    column: Slick.Column<Slick.SlickData>;
}

export class ReactSlickGrid extends React.Component<ISlickGridProps, ISlickGridState> {
    private containerRef: React.RefObject<HTMLDivElement>;
    private dataView: Slick.Data.DataView<ISlickRow> = new Slick.Data.DataView();
    private columnFilters: Map<string, ISlickGridColumnFilter> = new Map<string, ISlickGridColumnFilter>();
    private resizeTimer?: number;

    constructor(props: ISlickGridProps) {
        super(props);
        this.state = { fontSize: 15 };
        this.containerRef = React.createRef<HTMLDivElement>();
        this.props.rowsAdded.subscribe(this.addedRows);
    }

    public componentDidMount = () => {
        window.addEventListener('resize', this.windowResized);

        if (this.containerRef.current) {
            // Compute font size
            const fontSize = parseInt(getComputedStyle(this.containerRef.current).getPropertyValue('--code-font-size'), 10);

            // Setup options for the grid
            const options : Slick.GridOptions<Slick.SlickData> = {
                asyncEditorLoading: true,
                editable: false,
                enableCellNavigation: true,
                showHeaderRow: true,
                enableColumnReorder: false,
                explicitInitialization: true,
                viewportClass: 'react-grid',
                rowHeight: fontSize + 2
            };

            // Transform columns so they are sortable and stylable
            const columns = this.props.columns.map(c => {
                c.sortable = true;
                c.headerCssClass = 'react-grid-header-cell';
                c.cssClass = 'react-grid-cell';
                return c;
            });

            // Create the grid
            const grid = new Slick.Grid<ISlickRow>(
                this.containerRef.current,
                this.dataView,
                columns,
                options
            );

            // Setup our dataview
            this.dataView.beginUpdate();
            this.dataView.setFilter(this.filter.bind(this));
            this.dataView.setItems([], this.props.idProperty);
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

            // Set the initial sort column to our index column
            const indexColumn = columns.find(c => c.field === this.props.idProperty);
            if (indexColumn && indexColumn.id) {
                grid.setSortColumn(indexColumn.id, true);
            }

            // Save in our state
            this.setState({ grid, fontSize });
        }

        // Act like a resize happened to refresh the layout.
        this.windowResized();
    }

    public componentWillUnmount = () => {
        if (this.resizeTimer) {
            window.clearTimeout(this.resizeTimer);
        }
        window.removeEventListener('resize', this.windowResized);
        if (this.state.grid) {
            this.state.grid.destroy();
        }
    }

    public componentDidUpdate = (_prevProps: ISlickGridProps, prevState: ISlickGridState) => {
        if (this.state.showingFilters && this.state.grid) {
            this.state.grid.setHeaderRowVisibility(true);
        } else if (this.state.showingFilters === false && this.state.grid) {
            this.state.grid.setHeaderRowVisibility(false);
        }

        // If this is our first time setting the grid, we need to dynanically modify the styles
        // that the slickGrid generates for the rows. It's eliminating some of the height
        if (!prevState.grid && this.state.grid && this.containerRef.current) {
            const gridName = (this.state.grid as any).getUID() as string;
            const document = this.containerRef.current.ownerDocument;
            if (document) {
                const cssOverrideNode = document.createElement('style');
                const rule = `.${gridName} .slick-cell {height: ${this.state.fontSize + 2}px;}`;
                cssOverrideNode.setAttribute('type', 'text/css');
                cssOverrideNode.setAttribute('rel', 'stylesheet');
                cssOverrideNode.appendChild(document.createTextNode(rule));
                document.head.appendChild(cssOverrideNode);
            }
        }
    }

    public render() {
        return (
            <div className='outer-container'>
                <button className='react-grid-filter-button' onClick={this.clickFilterButton}>Filter Rows</button>
                <div className='react-grid-container' ref={this.containerRef}>
                </div>
            </div>
        );
    }

    private windowResized = () => {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(this.updateGridSize, 10);
    }

    private updateGridSize = () => {
        if (this.state.grid) {
            this.state.grid.resizeCanvas();
        }
    }

    private addedRows = (_e: Slick.EventData, data: ISlickGridAdd) => {
        this.dataView.beginUpdate();
        for (const row of data.newRows) {
            this.dataView.addItem(row);
        }
        this.dataView.endUpdate();

        // This should cause a rowsChanged event in the dataview that will
        // refresh the grid.
    }

    // tslint:disable-next-line: no-any
    private filter(item: any, _args: any): boolean {
        const fields = Array.from(this.columnFilters.keys());
        for (const field of fields) {
            if (field) {
                const filter = this.columnFilters.get(field);
                if (filter) {
                    const itemField = item[field];
                    const actualText = itemField !== null && itemField !== undefined ? itemField.toString() : '';
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
        if (column && column.field) {
            this.columnFilters.set(column.field, { text, column });
            this.dataView.refresh();
        }
    }

    private sort = (_e: Slick.EventData, args: Slick.OnSortEventArgs<Slick.SlickData>) => {
        // Note: dataView.fastSort is an IE workaround. Not necessary.
        this.dataView.sort((l: any, r: any) => this.compareElements(l, r, args.sortCol), args.sortAsc);
        args.grid.invalidateAllRows();
        args.grid.render();
    }

    private compareElements(a: any, b: any, col?: Slick.Column<Slick.SlickData>) : number {
        if (col) {
            const sortColumn = col.field;
            if (sortColumn && col.hasOwnProperty('type')) {
                const columnType = (col as any).type;
                const isStringColumn = columnType === 'string' || columnType === 'object';
                if (isStringColumn) {
                    const aVal = a[sortColumn] ? a[sortColumn].toString() : '';
                    const bVal = b[sortColumn] ? b[sortColumn].toString() : '';
                    const aStr = aVal ? aVal.substring(0, Math.min(aVal.length, MaxStringCompare)) : aVal;
                    const bStr = bVal ? bVal.substring(0, Math.min(bVal.length, MaxStringCompare)) : bVal;
                    return aStr.localeCompare(bStr);
                } else {
                    const aVal = a[sortColumn];
                    const bVal = b[sortColumn];
                    return aVal === bVal ? 0 : aVal > bVal ? 1 : -1;
                }
            }
        }

        // No sort column, try index column
        if (a.hasOwnProperty(this.props.idProperty) && b.hasOwnProperty(this.props.idProperty)) {
            const sortColumn = this.props.idProperty;
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            return aVal === bVal ? 0 : aVal > bVal ? 1 : -1;
        }

        return -1;
    }
}
