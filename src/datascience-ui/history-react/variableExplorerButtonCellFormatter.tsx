// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { getLocString } from '../react-common/locReactSide';
import { CellButton } from './cellButton';
import { Image, ImageName } from './image';
import './variableExplorerButtonCellFormatter.css';

import * as React from 'react';

interface IButtonCellValue {
    supportsDataExplorer: boolean;
    name: string;
}

interface IVariableExplorerButtonCellFormatterProps {
    baseTheme: string;
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
                        <CellButton baseTheme={this.props.baseTheme} tooltip={getLocString('DataScience.showDataExplorerTooltip', 'Show variable in data viewer.')} onClick={this.onDataExplorerClick}>
                            <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.OpenInNewWindow}/>
                        </CellButton>
                    </div>
                );
            } else {
                return(null);
            }
        }
        return [];
    }

    private onDataExplorerClick = () => {
        if (this.props.value !== null && this.props.value !== undefined) {
            this.props.showDataExplorer(this.props.value.name);
        }
    }
}
