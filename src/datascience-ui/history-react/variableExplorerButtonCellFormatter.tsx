// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './variableExplorerButtonCellFormatter.css';

import * as React from 'react';

interface IButtonCellValue {
    supportsDataExplorer: boolean;
    name: string;
}

interface IVariableExplorerButtonCellFormatterProps {
    value?: IButtonCellValue;
    showDataExplorer(targetVariable: string): void;
}

export class VariableExplorerButtonCellFormatter extends React.Component<IVariableExplorerButtonCellFormatterProps> {
    public shouldComponentUpdate(nextProps: IVariableExplorerButtonCellFormatterProps) {
        return nextProps.value !== this.props.value;
    }

    public render() {
        const className = 'variable-explorer-button-cell';
        if (this.props.value !== null && this.props.value !== undefined) {
            if (this.props.value.supportsDataExplorer) {
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
        }
        return [];
    }

    private onClick = () => {
        if (this.props.value !== null && this.props.value !== undefined) {
            this.props.showDataExplorer(this.props.value.name);
        }
    }
}
