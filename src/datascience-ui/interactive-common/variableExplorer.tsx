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

// tslint:disable-next-line: import-name
import Draggable from 'react-draggable';

import { IVariableState } from './redux/reducers/variables';
import './variableExplorerGrid.less';

interface IVariableExplorerProps {
    baseTheme: string;
    skipDefault?: boolean;
    variables: IJupyterVariable[];
    debugging: boolean;
    supportsDebugging: boolean;
    fontSize: number;
    executionCount: number;
    refreshCount: number;
    offsetHeight: number;
    gridHeight: number;
    containerHeight: number;
    showDataExplorer(targetVariable: IJupyterVariable, numberOfColumns: number): void;
    closeVariableExplorer(): void;
    setVariableExplorerHeight(containerHeight: number, gridHeight: number): void;
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
    containerHeight: number;
    gridHeight: number;
}

// tslint:disable:no-any
export class VariableExplorer extends React.Component<IVariableExplorerProps, IVariableExplorerState> {
    private variableExplorerRef: React.RefObject<HTMLDivElement>;
    private variableExplorerMenuBarRef: React.RefObject<HTMLDivElement>;
    private variablePanelRef: React.RefObject<HTMLDivElement>;

    private pageSize: number = -1;

    // These values keep track of variable requests so we don't make the same ones over and over again
    // Note: This isn't in the redux state because the requests will come before the state
    // has been updated. We don't want to force a wait for redraw to determine if a request
    // has been sent or not.
    private requestedPages: number[] = [];
    private requestedPagesExecutionCount: number = 0;
    private requestedRefreshCount: number = 0;
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

        this.state = {
            containerHeight: this.props.containerHeight,
            gridHeight: this.props.gridHeight
        };

        this.handleResizeMouseMove = this.handleResizeMouseMove.bind(this);
        this.setInitialHeight = this.setInitialHeight.bind(this);
        this.saveCurrentSize = this.saveCurrentSize.bind(this);

        this.gridColumns = [
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
            },
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
            }
        ];

        this.variableExplorerRef = React.createRef<HTMLDivElement>();
        this.variablePanelRef = React.createRef<HTMLDivElement>();
        this.variableExplorerMenuBarRef = React.createRef<HTMLDivElement>();
    }

    public componentDidMount() {
        if (this.state.containerHeight === 0) {
            this.setInitialHeight();
        }
    }

    public shouldComponentUpdate(nextProps: IVariableExplorerProps, prevState: IVariableState): boolean {
        if (this.props.fontSize !== nextProps.fontSize) {
            // Size has changed, recompute page size
            this.pageSize = -1;
            return true;
        }
        if (!fastDeepEqual(this.props.variables, nextProps.variables)) {
            return true;
        }
        if (
            prevState.containerHeight !== this.state.containerHeight ||
            prevState.gridHeight !== this.state.gridHeight
        ) {
            return true;
        }

        return false;
    }

    public render() {
        const contentClassName = `variable-explorer-content`;
        const containerHeight = this.state.containerHeight;
        let variableExplorerStyles: React.CSSProperties = { fontSize: `${this.props.fontSize.toString()}px` };

        // add properties to explorer styles
        if (containerHeight !== 0) {
            variableExplorerStyles = { ...variableExplorerStyles, height: containerHeight };
        }

        return (
            <Draggable handle=".handle-resize" onDrag={this.handleResizeMouseMove} onStop={this.saveCurrentSize}>
                <span>
                    <div id="variable-panel" ref={this.variablePanelRef}>
                        <div id="variable-panel-padding">
                            <div
                                className="variable-explorer"
                                ref={this.variableExplorerRef}
                                style={variableExplorerStyles}
                            >
                                <div className="variable-explorer-menu-bar" ref={this.variableExplorerMenuBarRef}>
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
                                <div className={contentClassName}>{this.renderGrid()}</div>
                            </div>
                        </div>
                        <div id="variable-divider" className="handle-resize" />
                    </div>
                </span>
            </Draggable>
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
                        headerRowHeight={this.getRowHeight()}
                        rowHeight={this.getRowHeight()}
                        onRowDoubleClick={this.rowDoubleClick}
                        emptyRowsView={VariableExplorerEmptyRowsView}
                        rowRenderer={VariableExplorerRowRenderer}
                    />
                </div>
            );
        }
    }

    private saveCurrentSize() {
        this.props.setVariableExplorerHeight(this.state.containerHeight, this.state.gridHeight);
    }

    private getRowHeight() {
        return this.props.fontSize + 9;
    }

    private setInitialHeight() {
        const variablePanel = this.variablePanelRef.current;
        if (!variablePanel) {
            return;
        }
        this.setState({
            containerHeight: variablePanel.offsetHeight
        });
    }

    private handleResizeMouseMove(e: any) {
        this.setVariableExplorerHeight(e);
        this.setVariableGridHeight();
    }

    private setVariableExplorerHeight(e: MouseEvent) {
        const variableExplorerMenuBar = this.variableExplorerMenuBarRef.current;
        const variablePanel = this.variablePanelRef.current;
        const variableExplorer = this.variableExplorerRef.current;

        if (!variableExplorerMenuBar || !variablePanel || !variableExplorer) {
            return;
        }

        const relY = e.pageY - variableExplorer.clientTop;
        const addHeight = relY - variablePanel.offsetHeight - this.props.offsetHeight;
        const updatedHeight = this.state.containerHeight + addHeight;

        // min height is one row of visible data
        const minHeight = this.getRowHeight() * 2 + variableExplorerMenuBar.clientHeight;
        const maxHeight = document.body.scrollHeight - this.props.offsetHeight - variableExplorerMenuBar.clientHeight;

        if (updatedHeight >= minHeight && updatedHeight <= maxHeight) {
            this.setState({
                containerHeight: updatedHeight
            });
        }
    }

    private setVariableGridHeight() {
        const variableExplorerMenuBar = this.variableExplorerMenuBarRef.current;

        if (!variableExplorerMenuBar) {
            return;
        }

        const updatedHeight = this.state.containerHeight - variableExplorerMenuBar.clientHeight;

        this.setState({
            gridHeight: updatedHeight
        });
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
            if (this.variableExplorerRef.current) {
                this.pageSize = Math.max(
                    16,
                    Math.round(this.variableExplorerRef.current.offsetHeight / this.props.fontSize)
                );
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
        const newExecution =
            this.props.executionCount !== this.requestedPagesExecutionCount ||
            this.props.refreshCount !== this.requestedRefreshCount;
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
            if (
                this.requestedPagesExecutionCount !== this.props.executionCount ||
                this.requestedRefreshCount !== this.props.refreshCount
            ) {
                this.requestedPages = [];
            }

            // Save in the list of requested pages
            this.requestedPages.push(pageIndex + 1);

            // Save the execution count for this request so we can verify we can skip it on next request.
            this.requestedPagesExecutionCount = this.props.executionCount;
            this.requestedRefreshCount = this.props.refreshCount;

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
