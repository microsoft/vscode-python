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
    supportsDebugging: boolean;
    fontSize: number;
    executionCount: number;
    showDataExplorer(targetVariable: IJupyterVariable, numberOfColumns: number): void;
    closeVariableExplorer(): void;
    pageIn(startIndex: number, pageSize: number): void;
}

const defaultColumnProperties = {
    filterable: false,
    sortable: false,
    resizable: true
};

interface IFormatterArgs {
    isScrolling?: boolean;
    value?: string | number | object | boolean;
    row?: IGridRow;
}

interface IGridRow {
    // tslint:disable-next-line:no-any
    name: string;
    type: string;
    size: string;
    value: string | undefined;
    index: number;
    buttons: IButtonCellValue;
}

interface IVariableExplorerState {
    wrapHeight: number;
    gridHeight: number;
    isResizing: boolean;
}

// tslint:disable:no-any
export class VariableExplorer extends React.Component<IVariableExplorerProps, IVariableExplorerState> {
    private divRef: React.RefObject<HTMLDivElement>;
    private pageSize: number = -1;

    // Used for handling resizing
    private minHeight: number = 50;
    private dragOffset: number = 35;
    private minGridHeight: number = 300;

    // These values keep track of variable requests so we don't make the same ones over and over again
    // Note: This isn't in the redux state because the requests will come before the state
    // has been updated. We don't want to force a wait for redraw to determine if a request
    // has been sent or not.
    private requestedPages: number[] = [];
    private requestedPagesExecutionCount: number = 0;
    private gridColumns: {
        key: string;
        name: string;
        type: string;
        width: number;
        formatter: any;
        headerRenderer?: JSX.Element;
        sortable?: boolean;
        resizable?: boolean;
    }[];

    constructor(prop: IVariableExplorerProps) {
        super(prop);

        this.state = { wrapHeight: 0, gridHeight: this.minGridHeight, isResizing: false };
        this.handleResizeMouseDown = this.handleResizeMouseDown.bind(this);
        this.handleResizeMouseUp = this.handleResizeMouseUp.bind(this);
        this.handleResizeMouseMove = this.handleResizeMouseMove.bind(this);
        this.stopResize = this.stopResize.bind(this);

        this.gridColumns = [
            {
                key: 'name',
                name: getLocString('DataScience.variableExplorerNameColumn', 'Name'),
                type: 'string',
                width: 120,
                formatter: this.formatNameColumn,
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
                formatter: (
                    <VariableExplorerButtonCellFormatter
                        showDataExplorer={this.props.showDataExplorer}
                        baseTheme={this.props.baseTheme}
                    />
                )
            }
        ];

        this.divRef = React.createRef<HTMLDivElement>();
    }

    public componentDidMount() {
        const variableExplorer: HTMLElement | null = document.getElementById('variable-explorer');
        this.setState({
            wrapHeight: variableExplorer!.offsetHeight
        });
        //document.addEventListener('mouseout', this.stopResize);
    }

    public componentWillUnmount() {
        this.stopResize();
        document.removeEventListener('mouseout', this.stopResize);
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
        if (this.state.isResizing) {
            return true;
        }
        return false;
    }

    public render() {
        const contentClassName = `variable-explorer-content`;

        const explorerStyles: React.CSSProperties = { fontSize: `${this.props.fontSize.toString()}px` };

        const wrapHeight = this.state.wrapHeight;

        // add properties to explorer styles if applicable
        if (wrapHeight && wrapHeight !== 0) {
            Object.assign(explorerStyles, { height: wrapHeight });
        }
        if (this.state.isResizing) {
            Object.assign(explorerStyles, { cursor: 'ns-resize' });
        }

        return (
            <div id="variable-explorer-wrapper">
                <div className="variable-explorer" id="variable-explorer" ref={this.divRef} style={explorerStyles}>
                    <div className="variable-explorer-menu-bar" id="variable-explorer-menu-bar">
                        <label className="inputLabel variable-explorer-label">
                            {getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}
                        </label>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            onClick={this.props.closeVariableExplorer}
                            className="variable-explorer-close-button"
                            tooltip={getLocString('DataScience.close', 'Close')}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.Cancel}
                            />
                        </ImageButton>
                    </div>
                    <div id="variable-grid" className={contentClassName}>
                        {this.renderGrid()}
                    </div>
                </div>
                <div id="variable-divider" role="separator" onMouseDown={this.handleResizeMouseDown} />
            </div>
        );
    }

    private renderGrid() {
        if (this.props.debugging && !this.props.supportsDebugging) {
            return (
                <span className="span-debug-message">
                    {getLocString(
                        'DataScience.variableExplorerDisabledDuringDebugging',
                        "Please see the Debug Side Bar's VARIABLES section."
                    )}
                </span>
            );
        } else {
            return (
                <div
                    id="variable-explorer-data-grid"
                    role="table"
                    aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}
                >
                    <AdazzleReactDataGrid
                        columns={this.gridColumns.map((c) => {
                            return { ...defaultColumnProperties, ...c };
                        })}
                        // tslint:disable-next-line: react-this-binding-issue
                        rowGetter={this.getRow}
                        rowsCount={this.props.variables.length}
                        minHeight={this.state.gridHeight}
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

    private stopResize() {
        this.setState({
            isResizing: false
        });
    }

    private handleResizeMouseDown() {
        this.setState({
            isResizing: true
        });
        document.addEventListener('mouseup', this.handleResizeMouseUp);
        document.addEventListener('mousemove', this.handleResizeMouseMove);
    }

    private handleResizeMouseUp() {
        this.stopResize();
        document.removeEventListener('mousemove', this.handleResizeMouseMove);
        document.removeEventListener('mouseup', this.handleResizeMouseUp);
    }

    private handleResizeMouseMove(e: any) {
        if (!this.state.isResizing) {
            return; // exit if not in resize mode
        }
        this.setVariableExplorerHeight(e);
        this.setVariableGridHeight();
    }

    private setVariableExplorerHeight(e: MouseEvent) {
        // Set height for exterior div
        const variablePanel: HTMLElement | null = document.getElementById('variable-panel');
        const variableExplorer: HTMLElement | null = document.getElementById('variable-explorer');
        const relY: number = e.pageY - variableExplorer!.clientTop;
        const addHeight: number = relY - variablePanel!.offsetHeight;
        const updatedHeight: number = this.state.wrapHeight + addHeight - this.dragOffset;

        if (updatedHeight >= this.minHeight) {
            this.setState({
                wrapHeight: updatedHeight
            });
        }
    }

    private setVariableGridHeight() {
        const variableExplorerMenuBar = document.getElementById('variable-explorer-menu-bar');
        const variableExplorer: HTMLElement | null = document.getElementById('variable-explorer');
        const updatedHeight: number =
            variableExplorer!.clientHeight - variableExplorerMenuBar!.clientHeight - this.props.fontSize + 9;

        if (updatedHeight >= this.minHeight) {
            this.setState({
                gridHeight: updatedHeight
            });
        }
    }

    private formatNameColumn = (args: IFormatterArgs): JSX.Element => {
        if (!args.isScrolling && args.row !== undefined && !args.value) {
            this.ensureLoaded(args.row.index);
        }

        return <VariableExplorerCellFormatter value={args.value} role={'cell'} cellStyle={CellStyle.variable} />;
    };

    private getRow = (index: number): IGridRow => {
        if (index >= 0 && index < this.props.variables.length) {
            const variable = this.props.variables[index];
            if (variable && variable.value) {
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
                        variable,
                        numberOfColumns: this.getColumnCountFromShape(variable.shape)
                    },
                    name: variable.name,
                    type: variable.type,
                    size: newSize,
                    index,
                    value: variable.value
                        ? variable.value
                        : getLocString('DataScience.variableLoadingValue', 'Loading...')
                };
            }
        }

        return {
            buttons: { supportsDataExplorer: false, name: '', numberOfColumns: 0, variable: undefined },
            name: '',
            type: '',
            size: '',
            index,
            value: getLocString('DataScience.variableLoadingValue', 'Loading...')
        };
    };

    private computePageSize(): number {
        if (this.pageSize === -1) {
            // Based on font size and height of the main div
            if (this.divRef.current) {
                this.pageSize = Math.max(16, Math.round(this.divRef.current.offsetHeight / this.props.fontSize));
            } else {
                this.pageSize = 50;
            }
        }
        return this.pageSize;
    }

    private ensureLoaded = (index: number) => {
        // Figure out how many items in a page
        const pageSize = this.computePageSize();

        // Skip if already pending or already have a value
        const haveValue = this.props.variables[index]?.value;
        const newExecution = this.props.executionCount !== this.requestedPagesExecutionCount;
        // tslint:disable-next-line: restrict-plus-operands
        const notRequested = !this.requestedPages.find((n) => n <= index && index < n + pageSize);
        if (!haveValue && (newExecution || notRequested)) {
            // Try to find a page of data around this index.
            let pageIndex = index;
            while (
                pageIndex >= 0 &&
                pageIndex > index - pageSize / 2 &&
                (!this.props.variables[pageIndex] || !this.props.variables[pageIndex].value)
            ) {
                pageIndex -= 1;
            }

            // Clear out requested pages if new requested execution
            if (this.requestedPagesExecutionCount !== this.props.executionCount) {
                this.requestedPages = [];
            }

            // Save in the list of requested pages
            this.requestedPages.push(pageIndex + 1);

            // Save the execution count for this request so we can verify we can skip it on next request.
            this.requestedPagesExecutionCount = this.props.executionCount;

            // Load this page.
            this.props.pageIn(pageIndex + 1, pageSize);
        }
    };

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
        if (
            row.buttons &&
            row.buttons.supportsDataExplorer !== undefined &&
            row.buttons.name &&
            row.buttons.supportsDataExplorer &&
            row.buttons.variable
        ) {
            this.props.showDataExplorer(row.buttons.variable, row.buttons.numberOfColumns);
        }
    };
}
