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

import * as AdazzleReactDataGrid from 'react-data-grid';

//import 'bootstrap/dist/css/bootstrap.css'

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
}

const defaultColumnProperties = {
    filterable: false,
    sortable: false,
    resizable: false
};

interface IGridRow {
    // tslint:disable-next-line:no-any
    [name: string]: any;
}

export class VariableExplorer extends React.Component<IVariableExplorerProps, IVariableExplorerState> {
    constructor(prop: IVariableExplorerProps) {
        super(prop);
        const columns = [
            {key: 'name', name: 'Name', type: 'string', width: 120},
            {key: 'type', name: 'Type', type: 'string', width: 120},
            {key: 'value', name: 'Value', type: 'string', width: 300}
        ];
        this.state = { open: false,
                        gridColumns: columns,
                        gridRows: [],
                        gridHeight: 200,
                        height: 0};
    }

    public render() {
        if (getSettings && getSettings().showJupyterVariableExplorer) {
            const contentClassName = `variable-explorer-content ${this.state.open ? '' : ' hide'}`;
            return(
                <div className='variable-explorer'>
                    <CollapseButton theme={this.props.baseTheme}
                        visible={true}
                        open={this.state.open}
                        onClick={this.toggleInputBlock}
                        tooltip={getLocString('DataScience.collapseVariableExplorerTooltip', 'Collapse variable explorer')}
                        label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variable Explorer')} />
                    <div className={contentClassName}>
                        <AdazzleReactDataGrid
                            columns = {this.state.gridColumns.map(c => { return {...c, ...defaultColumnProperties}; })}
                            rowGetter = {this.getRow}
                            rowsCount = {this.state.gridRows.length}
                            minHeight = {this.state.gridHeight}
                        />
                    </div>
                </div>
            );
        }

        return null;
    }

    public componentDidMount = () => {
        this.updateHeight();
    }

    public componentDidUpdate = () => {
        this.updateHeight();
    }

    // New variable data passed in via a ref
    // Help to keep us independent of main history window state if we choose to break out the variable explorer
    public newVariablesData(newVariables: IJupyterVariable[]) {
        const newGridRows = newVariables.map(newVar => {
            return {name: newVar.name, type: newVar.type, value: getLocString('DataScience.variableLoadingValue', 'Loading...')};
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
        return {name: '', type: '', value: ''};
    }

    private toggleInputBlock = () => {
        this.setState({open: !this.state.open});

        // If we toggle open request a data refresh
        if (!this.state.open) {
            this.props.refreshVariables();
        }
    }
}
