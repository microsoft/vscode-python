// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { MaxStringCompare } from '../../client/datascience/data-viewing/types';
import { KeyCodes } from '../react-common/constants';
import { measureText } from '../react-common/textMeasure';
import { ReactSlickGridFilterBox } from './reactSlickGridFilterBox';

// Slickgrid requires jquery to be defined. Globally. So we do some hacks here.
// We need to manipulate the grid with the same jquery that it uses
// use slickgridJQ instead of the usual $ to make it clear that we need that JQ and not
// the one currently in node-modules
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery!slickgrid/lib/jquery-1.11.2.min');
// tslint:disable-next-line: no-var-requires no-require-imports
const slickgridJQ = require('slickgrid/lib/jquery-1.11.2.min');
// tslint:disable-next-line: no-var-requires no-require-imports
require('expose-loader?jQuery.fn.drag!slickgrid/lib/jquery.event.drag-2.3.0');

import 'slickgrid/slick.core';
import 'slickgrid/slick.dataview';
import 'slickgrid/slick.grid';

import 'slickgrid/plugins/slick.autotooltips';

import 'slickgrid/slick.grid.css';

// Make sure our css comes after the slick grid css. We override some of its styles.
import './reactSlickGrid.css';

const MinColumnWidth = 70;
const MaxColumnWidth = 500;

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
    filterRowsText: string;
    filterRowsTooltip: string;
    forceHeight?: number;
}

interface ISlickGridState {
    grid?: Slick.Grid<ISlickRow>;
    showingFilters?: boolean;
    fontSize: number;
}

class ColumnFilter {
    private matchFunc: (v: any) => boolean;
    private lessThanRegEx = /^\s*<\s*(\d+.*)/;
    private lessThanEqualRegEx = /^\s*<=\s*(\d+.*).*/;
    private greaterThanRegEx = /^\s*>\s*(\d+.*).*/;
    private greaterThanEqualRegEx = /^\s*>=\s*(\d+.*).*/;
    private equalThanRegEx = /^\s*=\s*(\d+.*).*/;

    constructor(text: string, column: Slick.Column<Slick.SlickData>) {
        if (text && text.length > 0) {
            const columnType = (column as any).type;
            switch (columnType) {
                case 'string':
                default:
                    this.matchFunc = (v: any) => !v || v.toString().includes(text);
                    break;

                case 'integer':
                case 'float':
                case 'int64':
                case 'float64':
                case 'number':
                    this.matchFunc = this.generateNumericOperation(text);
                    break;
            }
        } else {
            this.matchFunc = (_v: any) => true;
        }
    }

    public matches(value: any): boolean {
        return this.matchFunc(value);
    }

    private extractDigits(text: string, regex: RegExp): number {
        const match = regex.exec(text);
        if (match && match.length > 1) {
            return parseFloat(match[1]);
        }
        return 0;
    }

    private generateNumericOperation(text: string): (v: any) => boolean {
        if (this.lessThanRegEx.test(text)) {
            const n1 = this.extractDigits(text, this.lessThanRegEx);
            return (v: any) => v && v < n1;
        } else if (this.lessThanEqualRegEx.test(text)) {
            const n2 = this.extractDigits(text, this.lessThanEqualRegEx);
            return (v: any) => v && v <= n2;
        } else if (this.greaterThanRegEx.test(text)) {
            const n3 = this.extractDigits(text, this.greaterThanRegEx);
            return (v: any) => v && v > n3;
        } else if (this.greaterThanEqualRegEx.test(text)) {
            const n4 = this.extractDigits(text, this.greaterThanEqualRegEx);
            return (v: any) => v && v >= n4;
        } else if (this.equalThanRegEx.test(text)) {
            const n5 = this.extractDigits(text, this.equalThanRegEx);
            return (v: any) => v && v === n5;
        } else {
            const n6 = parseFloat(text);
            return (v: any) => v && v === n6;
        }
    }
}

export class ReactSlickGrid extends React.Component<ISlickGridProps, ISlickGridState> {
    private containerRef: React.RefObject<HTMLDivElement>;
    private measureRef: React.RefObject<HTMLDivElement>;
    private dataView: Slick.Data.DataView<ISlickRow> = new Slick.Data.DataView();
    private columnFilters: Map<string, ColumnFilter> = new Map<string, ColumnFilter>();
    private resizeTimer?: number;
    private autoResizedColumns: boolean = false;

    constructor(props: ISlickGridProps) {
        super(props);
        this.state = { fontSize: 15 };
        this.containerRef = React.createRef<HTMLDivElement>();
        this.measureRef = React.createRef<HTMLDivElement>();
        this.props.rowsAdded.subscribe(this.addedRows);
    }

    // tslint:disable-next-line:max-func-body-length
    public componentDidMount = () => {
        window.addEventListener('resize', this.windowResized);

        if (this.containerRef.current) {
            // Compute font size. Default to 15 if not found.
            let fontSize = parseInt(getComputedStyle(this.containerRef.current).getPropertyValue('--code-font-size'), 10);
            if (isNaN(fontSize)) {
                fontSize = 15;
            }

            // Setup options for the grid
            const options: Slick.GridOptions<Slick.SlickData> = {
                asyncEditorLoading: true,
                editable: false,
                enableCellNavigation: true,
                showHeaderRow: true,
                enableColumnReorder: false,
                explicitInitialization: false,
                viewportClass: 'react-grid',
                rowHeight: this.getAppropiateRowHeight(fontSize)
            };

            // Transform columns so they are sortable and stylable
            const columns = this.props.columns.map(c => {
                c.sortable = true;
                c.headerCssClass = 'react-grid-header-cell';
                c.cssClass = 'react-grid-cell';
                return c;
            });

            // Create the grid
            const grid = new Slick.Grid<ISlickRow>(this.containerRef.current, this.dataView, columns, options);
            grid.registerPlugin(new Slick.AutoTooltips({ enableForCells: true, enableForHeaderCells: true }));

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

            grid.onHeaderCellRendered.subscribe((_e, args) => {
                // Add a tab index onto our header cell
                args.node.tabIndex = 0;
            });

            // Unbind the slickgrid key handler from the canvas code
            // We want to keep EnableCellNavigation on so that we can use the slickgrid
            // public navigations functions, but we don't want the slickgrid keyhander
            // to eat tab keys and prevent us from tabbing to input boxes or column headers
            const canvasElement = grid.getCanvasNode();
            slickgridJQ(canvasElement).off('keydown');

            if (this.containerRef && this.containerRef.current) {
                // slickgrid creates empty focus sink div elements that capture tab input we don't want that
                // so unhook their key handlers and remove their tabindex
                const firstFocus = slickgridJQ('.react-grid-container')
                    .children()
                    .first();
                const lastFocus = slickgridJQ('.react-grid-container')
                    .children()
                    .last();
                slickgridJQ(firstFocus)
                    .off('keydown')
                    .removeAttr('tabindex');
                slickgridJQ(lastFocus)
                    .off('keydown')
                    .removeAttr('tabindex');

                // Set our key handling on the actual grid viewport
                slickgridJQ('.react-grid')
                    .on('keydown', this.slickgridHandleKeyDown)
                    .attr('role', 'grid')
                    .on('focusin', this.slickgridFocus);
                slickgridJQ('.grid-canvas').on('keydown', this.slickgridHandleKeyDown);
            }

            // Setup the sorting
            grid.onSort.subscribe(this.sort);

            // Init to force the actual render.
            grid.init();

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
    };

    public componentWillUnmount = () => {
        if (this.resizeTimer) {
            window.clearTimeout(this.resizeTimer);
        }
        window.removeEventListener('resize', this.windowResized);
        if (this.state.grid) {
            this.state.grid.destroy();
        }
    };

    public componentDidUpdate = (_prevProps: ISlickGridProps, prevState: ISlickGridState) => {
        if (this.state.showingFilters && this.state.grid) {
            this.state.grid.setHeaderRowVisibility(true);
        } else if (this.state.showingFilters === false && this.state.grid) {
            this.state.grid.setHeaderRowVisibility(false);
        }

        // If this is our first time setting the grid, we need to dynanically modify the styles
        // that the slickGrid generates for the rows. It's eliminating some of the height
        if (!prevState.grid && this.state.grid && this.containerRef.current) {
            this.updateCssStyles();
        }
    };

    public render() {
        const style: React.CSSProperties = this.props.forceHeight
            ? {
                  height: `${this.props.forceHeight}px`,
                  width: `${this.props.forceHeight}px`
              }
            : {};

        return (
            <div className="outer-container">
                <button className="react-grid-filter-button" tabIndex={0} title={this.props.filterRowsTooltip} onClick={this.clickFilterButton}>
                    <span>{this.props.filterRowsText}</span>
                </button>
                <div className="react-grid-container" style={style} ref={this.containerRef}></div>
                <div className="react-grid-measure" ref={this.measureRef} />
            </div>
        );
    }

    // public for testing
    public sort = (_e: Slick.EventData, args: Slick.OnSortEventArgs<Slick.SlickData>) => {
        // Note: dataView.fastSort is an IE workaround. Not necessary.
        this.dataView.sort((l: any, r: any) => this.compareElements(l, r, args.sortCol), args.sortAsc);
        args.grid.invalidateAllRows();
        args.grid.render();
    };

    // These adjustments for the row height come from trial and error, by changing the font size in VS code,
    // opening a new Data Viewer, and making sure the data is visible
    // They were tested up to a font size of 60, and the row height still allows the content to be seen
    private getAppropiateRowHeight(fontSize: number): number {
        switch (true) {
            case fontSize < 15:
                return fontSize + 4;
            case fontSize < 20:
                return fontSize + 8;
            case fontSize < 30:
                return fontSize + 10;
            default:
                return fontSize + 12;
        }
    }

    // If the slickgrid gets focus and nothing is selected select the first item
    // so that you can keyboard navigate from there
    private slickgridFocus = (_e: any): void => {
        if (this.state.grid) {
            if (!this.state.grid.getActiveCell()) {
                this.state.grid.setActiveCell(0, 0);
            }
        }
    };

    private slickgridHandleKeyDown = (e: KeyboardEvent): void => {
        let handled: boolean = false;

        // Defined here:
        // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/Grid_Role#Keyboard_interactions

        if (this.state.grid) {
            // The slickgrid version of jquery populates keyCode not code, so use the numerical values here
            switch (e.keyCode) {
                case KeyCodes.LeftArrow:
                    this.state.grid.navigateLeft();
                    handled = true;
                    break;
                case KeyCodes.UpArrow:
                    this.state.grid.navigateUp();
                    handled = true;
                    break;
                case KeyCodes.RightArrow:
                    this.state.grid.navigateRight();
                    handled = true;
                    break;
                case KeyCodes.DownArrow:
                    this.state.grid.navigateDown();
                    handled = true;
                    break;
                case KeyCodes.PageUp:
                    this.state.grid.navigatePageUp();
                    handled = true;
                    break;
                case KeyCodes.PageDown:
                    this.state.grid.navigatePageDown();
                    handled = true;
                    break;
                case KeyCodes.End:
                    e.ctrlKey ? this.state.grid.navigateBottom() : this.state.grid.navigateRowEnd();
                    handled = true;
                    break;
                case KeyCodes.Home:
                    e.ctrlKey ? this.state.grid.navigateTop() : this.state.grid.navigateRowStart();
                    handled = true;
                    break;
                default:
            }
        }

        if (handled) {
            // Don't let the parent / browser do stuff if we handle it
            // otherwise we'll both move the cell selection and scroll the window
            // with up and down keys
            e.stopPropagation();
            e.preventDefault();
        }
    };

    private updateCssStyles = () => {
        if (this.state.grid && this.containerRef.current) {
            const gridName = (this.state.grid as any).getUID() as string;
            const document = this.containerRef.current.ownerDocument;
            if (document) {
                const cssOverrideNode = document.createElement('style');
                const rule = `.${gridName} .slick-cell {height: ${this.getAppropiateRowHeight(this.state.fontSize)}px;}`;
                cssOverrideNode.setAttribute('type', 'text/css');
                cssOverrideNode.setAttribute('rel', 'stylesheet');
                cssOverrideNode.appendChild(document.createTextNode(rule));
                document.head.appendChild(cssOverrideNode);
            }
        }
    };

    private windowResized = () => {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(this.updateGridSize, 10);
    };

    private updateGridSize = () => {
        if (this.state.grid && this.containerRef.current && this.measureRef.current) {
            // We use a div at the bottom to figure out our expected height. Slickgrid isn't
            // so good without a specific height set in the style.
            const height = this.measureRef.current.offsetTop - this.containerRef.current.offsetTop;
            this.containerRef.current.style.height = `${this.props.forceHeight ? this.props.forceHeight : height}px`;
            this.state.grid.resizeCanvas();
        }
    };

    private autoResizeColumns(rows: ISlickRow[]) {
        if (this.state.grid) {
            const fontString = this.computeFont();
            const columns = this.state.grid.getColumns();
            columns.forEach(c => {
                let colWidth = MinColumnWidth;
                rows.forEach((r: any) => {
                    const field = c.field ? r[c.field] : '';
                    const fieldWidth = field ? measureText(field.toString(), fontString) : 0;
                    colWidth = Math.min(MaxColumnWidth, Math.max(colWidth, fieldWidth));
                });
                c.width = colWidth;
            });
            this.state.grid.setColumns(columns);

            // We also need to update the styles as slickgrid will mess up the height of rows
            // again
            setTimeout(() => {
                this.updateCssStyles();

                // Hide the header row after we finally resize our columns
                this.state.grid!.setHeaderRowVisibility(false);
            }, 0);
        }
    }

    private computeFont(): string | null {
        if (this.containerRef.current) {
            const style = getComputedStyle(this.containerRef.current);
            return style ? style.font : null;
        }
        return null;
    }

    private addedRows = (_e: Slick.EventData, data: ISlickGridAdd) => {
        // Add all of these new rows into our data.
        this.dataView.beginUpdate();
        for (const row of data.newRows) {
            this.dataView.addItem(row);
        }

        // Update columns if we haven't already
        if (!this.autoResizedColumns) {
            this.autoResizedColumns = true;
            this.autoResizeColumns(data.newRows);
        }

        this.dataView.endUpdate();

        // This should cause a rowsChanged event in the dataview that will
        // refresh the grid.
    };

    // tslint:disable-next-line: no-any
    private filter(item: any, _args: any): boolean {
        const fields = Array.from(this.columnFilters.keys());
        for (const field of fields) {
            if (field) {
                const filter = this.columnFilters.get(field);
                if (filter) {
                    if (!filter.matches(item[field])) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private clickFilterButton = (e: React.SyntheticEvent) => {
        e.preventDefault();
        this.setState({ showingFilters: !this.state.showingFilters });
    };

    private renderFilterCell = (_e: Slick.EventData, args: Slick.OnHeaderRowCellRenderedEventArgs<Slick.SlickData>) => {
        ReactDOM.render(<ReactSlickGridFilterBox column={args.column} onChange={this.filterChanged} />, args.node);
    };

    private filterChanged = (text: string, column: Slick.Column<Slick.SlickData>) => {
        if (column && column.field) {
            this.columnFilters.set(column.field, new ColumnFilter(text, column));
            this.dataView.refresh();
        }
    };

    private compareElements(a: any, b: any, col?: Slick.Column<Slick.SlickData>): number {
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
