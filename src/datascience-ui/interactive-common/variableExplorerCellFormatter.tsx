// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorerCellFormatter.css';

import * as React from 'react';

export enum CellStyle {
    variable = 'variable',
    type = 'type',
    string = 'string',
    numeric = 'numeric'
}

interface IVariableExplorerCellFormatterProps {
    cellStyle: CellStyle;
    // value gets populated by the default cell formatter props
    value?: string | number | object | boolean;
    role?: string;
}

// Our formatter for cells in the variable explorer. Allow for different styles per column type
export class VariableExplorerCellFormatter extends React.Component<IVariableExplorerCellFormatterProps> {
    public shouldComponentUpdate(nextProps: IVariableExplorerCellFormatterProps) {
        return nextProps.value !== this.props.value;
    }

    public render() {
        const className = `react-grid-variable-explorer-cell-${this.props.cellStyle.toString()}`;
        if (this.props.value !== null && this.props.value !== undefined) {
            return (
                <div className={className} role={this.props.role ? this.props.role : 'cell'} title={this.props.value.toString()}>
                    {this.props.value}
                </div>
            );
        }
        return [];
    }
}
