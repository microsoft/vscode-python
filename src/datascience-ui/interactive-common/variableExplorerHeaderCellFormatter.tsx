// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as React from 'react';

interface IVariableExplorerHeaderCellFormatterProps {
    // value gets populated by the default cell formatter props
    column?: {
        name: string;
    };
}

// Our formatter for cells in the variable explorer. Allow for different styles per column type
export class VariableExplorerHeaderCellFormatter extends React.Component<IVariableExplorerHeaderCellFormatterProps> {
    public render() {
        if (this.props.column) {
            return (
                <div role="columnheader">
                    <span>{this.props.column.name}</span>
                </div>
            );
        }
    }
}
