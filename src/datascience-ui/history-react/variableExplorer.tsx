// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorer.css';

import * as React from 'react';
import { IJupyterVariable } from '../../client/datascience/types';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { CollapseButton } from './collapseButton';

import * as AdazzleReactDataGrid from 'react-data-grid';

//import 'bootstrap/dist/css/bootstrap.css'

//interface IVariableExplorerProps {
    //baseTheme: string;
    //variables?: IJupyterVariable[];
    //refreshVariables(): void;
//}

//interface IVariableExplorerState {
    //open: boolean;
    //gridColumns: {key: string, name: string}[];
    //gridRows: IGridRow[];
    //initialGridRows: IGridRow[];
    //filters: {};
    //gridHeight: number;
//}

interface IVariableExplorerProps {
    baseTheme: string;
    refreshVariables(): void;
}

interface IVariableExplorerState {
    open: boolean;
    gridColumns: {key: string, name: string}[];
    gridRows: IGridRow[];
    gridHeight: number;
}

const defaultColumnProperties = {
    filterable: false,
    sortable: false,
    resizable: false,
}

interface IGridRow {
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
                        gridHeight: 200};
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

    public newVariablesData(newVariables: IJupyterVariable[]) {
        const newGridRows = newVariables.map(newVar => {
            return {'name': newVar.name, 'type': newVar.type, 'value':'loading'}
        });

        this.setState({ gridRows: newGridRows});
    }

    public newVariableData(newVariable: IJupyterVariable) {
        // IANHU: This will eventually have to add in something like the execution count, can't just use the name
        // to match on
        let newGridRows = this.state.gridRows.slice();
        for (let i = 0; i < newGridRows.length; i++) {
            if (newGridRows[i]['name'] === newVariable.name) {
                const newGridRow = {...newGridRows[i], value: newVariable.value};
                newGridRows[i] = newGridRow;
            }
        }

        this.setState({ gridRows: newGridRows });
    }

    private getRow = (index: number) => {
        if (index >= 0 && index < this.state.gridRows.length) {
            return this.state.gridRows[index];
        }
        return {'name': '', 'type': '', 'value': ''};
    }

    private toggleInputBlock = () => {
        this.setState({open: !this.state.open});

        // If we toggle open request a data refresh
        if(!this.state.open) {
            this.props.refreshVariables();
        }
    }
}

//export class VariableExplorer extends React.Component<IVariableExplorerProps, IVariableExplorerState> {
    //constructor(prop: IVariableExplorerProps) {
        //super(prop);
        //const columns = [
            //{key: 'name', name: 'Name', type: 'string'},
            //{key: 'type', name: 'Type', type: 'string'},
            //{key: 'value', name: 'Value', type: 'string'}
        //];
        //this.state = { open: false,
                        //gridColumns: columns,
                        //gridRows: [],
                        //initialGridRows:[],
                        //filters: {},
                        //gridHeight: 200};
    //}

    //public render() {
        //if (getSettings && getSettings().showJupyterVariableExplorer) {
            //const contentClassName = `variable-explorer-content ${this.state.open ? '' : ' hide'}`;

            //return(
                //<div className='variable-explorer'>
                    //<CollapseButton theme={this.props.baseTheme}
                        //visible={true}
                        //open={this.state.open}
                        //onClick={this.toggleInputBlock}
                        //tooltip={getLocString('DataScience.collapseVariableExplorerTooltip', 'Collapse variable explorer')}
                        //label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variable Explorer')} />
                    //<div className={contentClassName}>
                        //<AdazzleReactDataGrid
                            //columns = {this.state.gridColumns.map(c => { return {...c, ...defaultColumnProperties}; })}
                            //rowGetter = {this.getRow}
                            //rowsCount = {this.props.variables ? this.props.variables.length : 0}
                            //minHeight = {this.state.gridHeight}
                        ///>
                    //</div>
                //</div>
            //);
        //}

        //return null;
    //}

    //private getRow = (index: number) => {
        //if (this.props.variables && index >= 0 && index < this.props.variables.length) {
            //return {
                //'name': this.props.variables[index].name,
                //'type': this.props.variables[index].type,
                //'value': 'loading value'
            //};
        //}

        //return {'name': '', 'type': '', 'value': ''};
    //}

    //private toggleInputBlock = () => {
        //this.setState({open: !this.state.open});

        //// If we toggle open request a data refresh
        //if(!this.state.open) {
            //this.props.refreshVariables();
        //}
    //}
//}
