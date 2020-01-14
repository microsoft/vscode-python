// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorer.css';

import * as fastDeepEqual from 'fast-deep-equal';
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
    debugging: boolean;
    fontSize: number;
    showDataExplorer(targetVariable: IJupyterVariable, numberOfColumns: number): void;
    closeVariableExplorer(): void;
    pageIn(startIndex: number, pageSize: number): void;
}

const defaultColumnProperties = {
    filterable: false,
    sortable: false,
    resizable: true
};

interface IGridRow {
    // tslint:disable-next-line:no-any
    name: string;
    type: string;
    size: string;
    value: string | undefined;
    buttons: IButtonCellValue;
}

// tslint:disable:no-any
export class VariableExplorer extends React.Component<IVariableExplorerProps> {
    private divRef: React.RefObject<HTMLDivElement>;
    private pageSize: number = -1;
    private gridColumns: {
        key: string;
        name: string;
        type: string;
        width: number;
        formatter: JSX.Element;
        headerRenderer?: JSX.Element;
        sortable?: boolean;
        resizable?: boolean;
    }[];

    constructor(prop: IVariableExplorerProps) {
        super(prop);
        this.gridColumns = [
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

        this.divRef = React.createRef<HTMLDivElement>();
    }

    public shouldComponentUpdate(nextProps: IVariableExplorerProps): boolean {
        if (this.props.fontSize !== nextProps.fontSize) {
            // Size has changed, recompute page size
            this.pageSize = -1;
            return true;
        }
        if (!fastDeepEqual(this.props.variables, nextProps.variables)) {
            return true;
        }
        return false;
    }

    public render() {
        const contentClassName = `variable-explorer-content`;

        const fontSizeStyle: React.CSSProperties = {
            fontSize: `${this.props.fontSize.toString()}px`
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

    private renderGrid() {
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
                        columns={this.gridColumns.map(c => {
                            return { ...defaultColumnProperties, ...c };
                        })}
                        // tslint:disable-next-line: react-this-binding-issue
                        rowGetter={this.getRow}
                        rowsCount={this.props.variables.length}
                        minHeight={200}
                        headerRowHeight={this.props.fontSize + 9}
                        rowHeight={this.props.fontSize + 9}
                        onRowDoubleClick={this.rowDoubleClick}
                        emptyRowsView={VariableExplorerEmptyRowsView}
                        rowRenderer={VariableExplorerRowRenderer}
                    />
                </div>
            );
        }
    }

    private getRow = (index: number): IGridRow => {
        if (index >= 0 && index < this.props.variables.length) {
            const variable = this.props.variables[index];
            if (!variable.value) {
                this.askForPage(index);
            }
            let newSize = '';
            if (variable.shape && variable.shape !== '') {
                newSize = variable.shape;
            } else if (variable.count) {
                newSize = variable.count.toString();
            }
            return {
                buttons: {
                    name: variable.name,
                    supportsDataExplorer: variable.supportsDataExplorer,
                    variable: variable,
                    numberOfColumns: this.getColumnCountFromShape(variable.shape)
                },
                name: variable.name,
                type: variable.type,
                size: newSize,
                value: variable.value ? variable.value : getLocString('DataScience.variableLoadingValue', 'Loading...')
            };
        }

        return { buttons: { supportsDataExplorer: false, name: '', numberOfColumns: 0, variable: undefined }, name: '', type: '', size: '', value: '' };
    };

    private computePageSize(): number {
        if (this.pageSize === -1) {
            // Based on font size and height of the main div
            if (this.divRef.current) {
                this.pageSize = Math.round(this.divRef.current.offsetHeight / this.props.fontSize);
            } else {
                this.pageSize = 50;
            }
        }
        return this.pageSize;
    }

    private askForPage(index: number) {
        // Figure out how many items in a page
        const pageSize = this.computePageSize();

        // Try to find a page of data around this index.
        let pos = index;
        while (pos > 0 && pos > index - pageSize / 2 && !this.props.variables[pos].value) {
            pos -= 1;
        }
        this.props.pageIn(pos, pageSize);
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

    private rowDoubleClick = (_rowIndex: number, row: IGridRow) => {
        // On row double click, see if data explorer is supported and open it if it is
        if (row.buttons && row.buttons.supportsDataExplorer !== undefined && row.buttons.name && row.buttons.supportsDataExplorer && row.buttons.variable) {
            this.props.showDataExplorer(row.buttons.variable, row.buttons.numberOfColumns);
        }
    };
}
