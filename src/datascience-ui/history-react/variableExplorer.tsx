// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorer.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { IJupyterVariable } from '../../client/datascience/types';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { CollapseButton } from './collapseButton';
import { CellStyle, VariableExplorerCellFormatter } from './variableExplorerCellFormatter';

import * as AdazzleReactDataGrid from 'react-data-grid';

import './variableExplorerGrid.scss';

interface IVariableExplorerProps {
    baseTheme: string;
    refreshVariables(): void;
    onHeightChange(): void;
}

interface IVariableExplorerState {
    open: boolean;
    gridColumns: {key: string; name: string}[];
    gridRows: IGridRow[];
    gridHeight: number;
    height: number;
    fontSize: number;
}

const defaultColumnProperties = {
    filterable: false,
    sortable: false,
    resizable: true
};

interface IGridRow {
    // tslint:disable-next-line:no-any
    [name: string]: any;
}

export class VariableExplorer extends React.Component<IVariableExplorerProps, IVariableExplorerState> {
    private divRef: React.RefObject<HTMLDivElement>;

    constructor(prop: IVariableExplorerProps) {
        super(prop);
        const columns = [
            {key: 'name', name: getLocString('DataScience.variableExplorerNameColumn', 'Name'), type: 'string', width: 120, formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.variable} />},
            {key: 'type', name: getLocString('DataScience.variableExplorerTypeColumn', 'Type'), type: 'string', width: 120, formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.type} />},
            {key: 'size', name: getLocString('DataScience.variableExplorerSizeColumn', 'Size'), type: 'number', width: 120, formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.numeric} />},
            {key: 'value', name: getLocString('DataScience.variableExplorerValueColumn', 'Value'), type: 'string', width: 300, formatter: <VariableExplorerCellFormatter cellStyle={CellStyle.string} />}
        ];
        this.state = { open: false,
                        gridColumns: columns,
                        gridRows: [],
                        gridHeight: 200,
                        height: 0,
                        fontSize: 14};

        this.divRef = React.createRef<HTMLDivElement>();
    }

    public render() {
        if (getSettings && getSettings().showJupyterVariableExplorer) {
            const contentClassName = `variable-explorer-content ${this.state.open ? '' : ' hide'}`;

            const fontSizeStyle: React.CSSProperties = {
                fontSize: `${this.state.fontSize.toString()}px`
            };

            return(
                <div className='variable-explorer' ref={this.divRef} style={fontSizeStyle}>
                    <CollapseButton theme={this.props.baseTheme}
                        visible={true}
                        open={this.state.open}
                        onClick={this.toggleInputBlock}
                        tooltip={getLocString('DataScience.collapseVariableExplorerTooltip', 'Collapse variable explorer')}
                        label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')} />
                    <div className={contentClassName}>
                        <div id='variable-explorer-data-grid'>
                            <AdazzleReactDataGrid
                                columns = {this.state.gridColumns.map(c => { return {...c, ...defaultColumnProperties}; })}
                                rowGetter = {this.getRow}
                                rowsCount = {this.state.gridRows.length}
                                minHeight = {this.state.gridHeight}
                                headerRowHeight = {this.state.fontSize + 9}
                                rowHeight = {this.state.fontSize + 9}
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }

    public componentDidMount = () => {
        // After mounting, check our computed style to see if the font size is changed
        if (this.divRef.current) {
            const newFontSize = parseInt(getComputedStyle(this.divRef.current).getPropertyValue('--code-font-size'), 10);

            // Make sure to check for update here so we don't update loop
            if (this.state.fontSize !== newFontSize) {
                this.setState({fontSize: newFontSize});
            }
        }

        this.updateHeight();
    }

    public componentDidUpdate = () => {
        this.updateHeight();
    }

    // New variable data passed in via a ref
    // Help to keep us independent of main history window state if we choose to break out the variable explorer
    public newVariablesData(newVariables: IJupyterVariable[]) {
        const newGridRows = newVariables.map(newVar => {
            return {name: newVar.name, type: newVar.type, size: newVar.size, value: getLocString('DataScience.variableLoadingValue', 'Loading...')};
        });

        this.setState({ gridRows: newGridRows});
    }

    // Update the value of a single variable already in our list
    public newVariableData(newVariable: IJupyterVariable) {
        // IANHU: This will eventually have to add in something like the execution count, can't just use the name
        // to match on
        const newGridRows = this.state.gridRows.slice();
        for (let i = 0; i < newGridRows.length; i = i + 1) {
            if (newGridRows[i].name === newVariable.name) {
                const newGridRow = {...newGridRows[i], value: newVariable.value};
                newGridRows[i] = newGridRow;
            }
        }

        this.setState({ gridRows: newGridRows });
    }

    private updateHeight = () => {
        // Make sure we check for a new height so we don't get into an update loop
        const divElement = ReactDOM.findDOMNode(this) as HTMLDivElement;

        if (divElement) {
            const newHeight = divElement.offsetHeight;

            if (this.state.height !== newHeight) {
                this.setState({height: newHeight});
                this.props.onHeightChange();
            }
        }
    }

    private getRow = (index: number) => {
        if (index >= 0 && index < this.state.gridRows.length) {
            return this.state.gridRows[index];
        }
        return {name: '', type: '', size: '', value: ''};
    }

    private toggleInputBlock = () => {
        this.setState({open: !this.state.open});

        // If we toggle open request a data refresh
        if (!this.state.open) {
            this.props.refreshVariables();
        }
    }
}
