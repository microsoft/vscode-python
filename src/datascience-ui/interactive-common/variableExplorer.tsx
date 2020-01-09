// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorer.css';

// tslint:disable-next-line: no-var-requires no-require-imports
const memoize = require('memoize-one');
import * as React from 'react';

import { RegExpValues } from '../../client/datascience/constants';
import { IJupyterVariable } from '../../client/datascience/types';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { IButtonCellValue, VariableExplorerButtonCellFormatter } from './variableExplorerButtonCellFormatter';
import { CellStyle, VariableExplorerCellFormatter } from './variableExplorerCellFormatter';
import { VariableExplorerEmptyRowsView } from './variableExplorerEmptyRows';

import * as AdazzleReactDataGrid from 'react-data-grid';
import { VariableExplorerHeaderCellFormatter } from './variableExplorerHeaderCellFormatter';
import { VariableExplorerRowRenderer } from './variableExplorerRowRenderer';

import './variableExplorerGrid.less';

interface IVariableExplorerProps {
    baseTheme: string;
    skipDefault?: boolean;
    variables: IJupyterVariable[];
    pendingVariableCount: number;
    debugging: boolean;
    showDataExplorer(targetVariable: string, numberOfColumns: number): void;
    closeVariableExplorer(): void;
}

interface IVariableExplorerState {
    gridColumns: { key: string; name: string }[];
    gridHeight: number;
    height: number;
    fontSize: number;
    sortDirection: string;
    sortColumn: string | number;
}

const defaultColumnProperties = {
    filterable: false,
    sortable: true,
    resizable: true
};

// Sanity check on our string comparisons
const MaxStringCompare = 400;

interface IGridRow {
    // tslint:disable-next-line:no-any
    name: string;
    type: string;
    size: string;
    value: string | undefined;
    buttons: IButtonCellValue;
}

// tslint:disable:no-any
export class VariableExplorer extends React.Component<IVariableExplorerProps, IVariableExplorerState> {
    private divRef: React.RefObject<HTMLDivElement>;
    private generateRows: any;

    constructor(prop: IVariableExplorerProps) {
        super(prop);
        const columns = [
            {
                key: 'name',
                name: getLocString('DataScience.variableExplorerNameColumn', 'Name'),
                type: 'string',
                width: 120,
                formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.variable} />,
                headerRenderer: <VariableExplorerHeaderCellFormatter />
            },
            {
                key: 'type',
                name: getLocString('DataScience.variableExplorerTypeColumn', 'Type'),
                type: 'string',
                width: 120,
                formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.string} />,
                headerRenderer: <VariableExplorerHeaderCellFormatter />
            },
            {
                key: 'size',
                name: getLocString('DataScience.variableExplorerSizeColumn', 'Count'),
                type: 'string',
                width: 120,
                formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.numeric} />,
                headerRenderer: <VariableExplorerHeaderCellFormatter />
            },
            {
                key: 'value',
                name: getLocString('DataScience.variableExplorerValueColumn', 'Value'),
                type: 'string',
                width: 300,
                formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.string} />,
                headerRenderer: <VariableExplorerHeaderCellFormatter />
            },
            {
                key: 'buttons',
                name: '',
                type: 'boolean',
                width: 34,
                sortable: false,
                resizable: false,
                formatter: <VariableExplorerButtonCellFormatter showDataExplorer={this.props.showDataExplorer} baseTheme={this.props.baseTheme} />
            }
        ];
        this.state = { gridColumns: columns, gridHeight: 200, height: 0, fontSize: 14, sortColumn: 'name', sortDirection: 'NONE' };

        this.divRef = React.createRef<HTMLDivElement>();

        // Memoize is different between the tests running and webpack. figure out which one
        // tslint:disable-next-line: no-any
        let memoize_func: any | undefined;
        if (memoize instanceof Function) {
            memoize_func = memoize;
        } else {
            memoize_func = memoize.default;
        }
        this.generateRows = memoize_func((variables: IJupyterVariable[], sortColumn: string | number, sortDirection: string): IGridRow[] => {
            const rows = !this.props.skipDefault ? this.generateDummyVariables() : this.parseVariables(variables);
            return this.internalSortRows(rows, sortColumn, sortDirection);
        });
    }

    public render() {
        const contentClassName = `variable-explorer-content`;

        const fontSizeStyle: React.CSSProperties = {
            fontSize: `${this.state.fontSize.toString()}px`
        };

        return (
            <div className="variable-explorer" ref={this.divRef} style={fontSizeStyle}>
                <div className="variable-explorer-menu-bar">
                    <label className="inputLabel variable-explorer-label">{getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}</label>
                    <ImageButton
                        baseTheme={this.props.baseTheme}
                        onClick={this.props.closeVariableExplorer}
                        className="variable-explorer-close-button"
                        tooltip={getLocString('DataScience.close', 'Close')}
                    >
                        <Image baseTheme={this.props.baseTheme} class="image-button-image" image={ImageName.Cancel} />
                    </ImageButton>
                </div>
                <div className={contentClassName}>{this.renderGrid()}</div>
            </div>
        );
    }

    public componentDidMount = () => {
        // After mounting, check our computed style to see if the font size is changed
        if (this.divRef.current) {
            const newFontSize = parseInt(getComputedStyle(this.divRef.current).getPropertyValue('--code-font-size'), 10);

            // Make sure to check for update here so we don't update loop
            // tslint:disable-next-line: use-isnan
            if (newFontSize && newFontSize !== NaN && this.state.fontSize !== newFontSize) {
                this.setState({ fontSize: newFontSize });
            }
        }
    };

    public sortRows = (sortColumn: string | number, sortDirection: string) => {
        this.setState({
            sortColumn,
            sortDirection
        });
    };

    private renderGrid() {
        // Compute our grid rows using a memoized version of the sortColumn, sortDirection, and variables
        // See this blog post
        // https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html#what-about-memoization
        const gridRows = this.generateRows(this.props.variables, this.state.sortColumn, this.state.sortDirection);
        const getRow = (index: number) => {
            if (index >= 0 && index < gridRows.length) {
                return gridRows[index];
            }
            return { buttons: { supportsDataExplorer: false, name: '', numberOfColumns: 0 }, name: '', type: '', size: '', value: '' };
        };

        if (this.props.debugging) {
            return (
                <span className="span-debug-message">
                    {getLocString('DataScience.variableExplorerDisabledDuringDebugging', "Please see the Debug Side Bar's VARIABLES section.")}
                </span>
            );
        } else {
            return (
                <div id="variable-explorer-data-grid" role="table" aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}>
                    <AdazzleReactDataGrid
                        columns={this.state.gridColumns.map(c => {
                            return { ...defaultColumnProperties, ...c };
                        })}
                        // tslint:disable-next-line: react-this-binding-issue
                        rowGetter={getRow}
                        rowsCount={gridRows.length}
                        minHeight={this.state.gridHeight}
                        headerRowHeight={this.state.fontSize + 9}
                        rowHeight={this.state.fontSize + 9}
                        onRowDoubleClick={this.rowDoubleClick}
                        onGridSort={this.sortRows}
                        emptyRowsView={VariableExplorerEmptyRowsView}
                        rowRenderer={VariableExplorerRowRenderer}
                    />
                </div>
            );
        }
    }

    private parseVariables(newVariables: IJupyterVariable[]) {
        return newVariables.map(newVar => {
            let newSize = '';
            if (newVar.shape && newVar.shape !== '') {
                newSize = newVar.shape;
            } else if (newVar.count) {
                newSize = newVar.count.toString();
            }

            return {
                buttons: {
                    name: newVar.name,
                    supportsDataExplorer: newVar.supportsDataExplorer,
                    numberOfColumns: this.getColumnCountFromShape(newVar.shape)
                },
                name: newVar.name,
                type: newVar.type,
                size: newSize,
                value: newVar.value ? newVar.value : getLocString('DataScience.variableLoadingValue', 'Loading...')
            };
        });
    }

    private generateDummyVariables(): IGridRow[] {
        return [
            {
                name: 'foo',
                value: 'bar',
                type: 'DataFrame',
                size: '(100, 100)',
                buttons: {
                    supportsDataExplorer: true,
                    name: 'foo',
                    numberOfColumns: 100
                }
            }
        ];
    }

    private getColumnType(key: string | number): string | undefined {
        let column;
        if (typeof key === 'string') {
            //tslint:disable-next-line:no-any
            column = this.state.gridColumns.find(c => c.key === key) as any;
        } else {
            // This is the index lookup
            column = this.state.gridColumns[key];
        }

        // Special case our size column, it's displayed as a string
        // but we will sort it like a number
        if (column && column.key === 'size') {
            return 'number';
        } else if (column && column.type) {
            return column.type;
        }
    }

    private getColumnCountFromShape(shape: string | undefined): number {
        if (shape) {
            // Try to match on the second value if there is one
            const matches = RegExpValues.ShapeSplitterRegEx.exec(shape);
            if (matches && matches.length > 1) {
                return parseInt(matches[1], 10);
            }
        }
        return 0;
    }

    private internalSortRows = (gridRows: IGridRow[], sortColumn: string | number, sortDirection: string): IGridRow[] => {
        // Default to the name column
        if (sortDirection === 'NONE') {
            sortColumn = 'name';
            sortDirection = 'ASC';
        }

        const columnType = this.getColumnType(sortColumn);
        const isStringColumn = columnType === 'string' || columnType === 'object';
        const invert = sortDirection !== 'DESC';

        // Use a special comparer for string columns as we can't compare too much of a string
        // or it will take too long
        const comparer = isStringColumn
            ? //tslint:disable-next-line:no-any
              (a: any, b: any): number => {
                  const aVal = a[sortColumn] as string;
                  const bVal = b[sortColumn] as string;
                  const aStr = aVal ? aVal.substring(0, Math.min(aVal.length, MaxStringCompare)).toUpperCase() : aVal;
                  const bStr = bVal ? bVal.substring(0, Math.min(bVal.length, MaxStringCompare)).toUpperCase() : bVal;
                  const result = aStr > bStr ? -1 : 1;
                  return invert ? -1 * result : result;
              }
            : //tslint:disable-next-line:no-any
              (a: any, b: any): number => {
                  const aVal = this.getComparisonValue(a, sortColumn);
                  const bVal = this.getComparisonValue(b, sortColumn);
                  const result = aVal > bVal ? -1 : 1;
                  return invert ? -1 * result : result;
              };

        return gridRows.sort(comparer);
    };

    // Get the numerical comparison value for a column
    private getComparisonValue(gridRow: IGridRow, sortColumn: string | number): number {
        // tslint:disable-next-line: no-any
        return sortColumn === 'size' ? this.sizeColumnComparisonValue(gridRow) : (gridRow as any)[sortColumn];
    }

    // The size column needs special casing
    private sizeColumnComparisonValue(gridRow: IGridRow): number {
        const sizeStr: string = gridRow.size as string;

        if (!sizeStr) {
            return -1;
        }

        let sizeNumber = -1;
        const commaIndex = sizeStr.indexOf(',');
        // First check the shape case like so (5000,1000) in this case we want the 5000 to compare with
        if (sizeStr[0] === '(' && commaIndex > 0) {
            sizeNumber = parseInt(sizeStr.substring(1, commaIndex), 10);
        } else {
            // If not in the shape format, assume a to i conversion
            sizeNumber = parseInt(sizeStr, 10);
        }

        // If our parse fails we get NaN for any case that like return -1
        return isNaN(sizeNumber) ? -1 : sizeNumber;
    }

    private rowDoubleClick = (_rowIndex: number, row: IGridRow) => {
        // On row double click, see if data explorer is supported and open it if it is
        if (row.buttons && row.buttons.supportsDataExplorer !== undefined && row.buttons.name && row.buttons.supportsDataExplorer) {
            this.props.showDataExplorer(row.buttons.name, row.buttons.numberOfColumns);
        }
    };
}
