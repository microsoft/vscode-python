// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorerButtonCellFormatter.css';

import * as React from 'react';

interface IButtonCellValue {
    type: string;
    name: string;
}

interface IVariableExplorerButtonCellFormatterProps {
    //value?: string | number | object | boolean;
    value?: IButtonCellValue;
    showDataExplorer(targetVariable: string): void;
}

// Move to constant?
const validDataTypes = ['list', 'Series', 'dict', 'ndarray', 'DataFrame'];

export class VariableExplorerButtonCellFormatter extends React.Component<IVariableExplorerButtonCellFormatterProps> {
    public shouldComponentUpdate(nextProps: IVariableExplorerButtonCellFormatterProps) {
        // IANHU: Update this
        return nextProps.value !== this.props.value;
    }

    public render() {
        const className = 'variable-explorer-button-cell';
        if (this.props.value !== null && this.props.value !== undefined) {

            if (validDataTypes.indexOf(this.props.value.type) !== -1) {
                return(
                    <div className={className}>
                        <button className='variable-explorer-button-cell-button remove-style' onClick={this.onClick}></button>
                    </div>
                );
            } else {
                return(
                    <div></div>
                );
            }
            //if (this.props.value) {
                //return(
                    //<div className={className}>
                        //<button className='variable-explorer-button-cell-button remove-style' onClick={this.onClick}></button>
                    //</div>
                //);
            //} else {
                //return(
                    //<div></div>
                //);
            //}
        }
        return [];
    }

    private onClick = () => {
        if (this.props.value !== null && this.props.value !== undefined) {
            this.props.showDataExplorer(this.props.value.name);
        }
    }
}
