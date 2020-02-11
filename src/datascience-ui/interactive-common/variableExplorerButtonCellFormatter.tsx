// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';

import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';

import { IJupyterVariable } from '../../client/datascience/types';
import './variableExplorerButtonCellFormatter.css';

export interface IButtonCellValue {
    supportsDataExplorer: boolean;
    name: string;
    variable?: IJupyterVariable;
    numberOfColumns: number;
}

interface IVariableExplorerButtonCellFormatterProps {
    baseTheme: string;
    value?: IButtonCellValue;
    showDataExplorer(targetVariable: IJupyterVariable, numberOfColumns: number): void;
}

export class VariableExplorerButtonCellFormatter extends React.Component<IVariableExplorerButtonCellFormatterProps> {
    public shouldComponentUpdate(nextProps: IVariableExplorerButtonCellFormatterProps) {
        return nextProps.value !== this.props.value;
    }

    public render() {
        const className = 'variable-explorer-button-cell';
        if (this.props.value !== null && this.props.value !== undefined) {
            if (this.props.value.supportsDataExplorer) {
                return (
                    <div className={className}>
                        <ImageButton
                            baseTheme={this.props.baseTheme}
                            tooltip={getLocString(
                                'DataScience.showDataExplorerTooltip',
                                'Show variable in data viewer.'
                            )}
                            onClick={this.onDataExplorerClick}
                        >
                            <Image
                                baseTheme={this.props.baseTheme}
                                class="image-button-image"
                                image={ImageName.OpenInNewWindow}
                            />
                        </ImageButton>
                    </div>
                );
            } else {
                return null;
            }
        }
        return [];
    }

    private onDataExplorerClick = () => {
        if (this.props.value !== null && this.props.value !== undefined && this.props.value.variable) {
            this.props.showDataExplorer(this.props.value.variable, this.props.value.numberOfColumns);
        }
    };
}
