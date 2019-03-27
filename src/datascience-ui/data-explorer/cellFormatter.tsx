// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './cellFormatter.css';

import { JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import { DataExplorerRowStates } from '../../client/datascience/data-viewing/types';
import { getLocString } from '../react-common/locReactSide';

interface ICellFormatterProps {
    value: string | number | object | boolean;
    row: JSONObject | string;
    dependentValues: string | undefined;
}

export class CellFormatter extends React.Component<ICellFormatterProps> {
    private loadingMessage = getLocString('DataScience.loadingMessage', 'loading ...');

    constructor(props: ICellFormatterProps) {
        super(props);
    }

    public render() {
        // If this is our special not set value, render a 'loading ...' value.
        if (this.props.row === DataExplorerRowStates.Skipped || this.props.row === DataExplorerRowStates.Fetching) {
            return (<span>{this.loadingMessage}</span>);
        }

        // Render based on type
        if (this.props.dependentValues && this.props.value !== null) {
            switch (this.props.dependentValues) {
                case 'bool':
                    return this.renderBool(this.props.value as boolean);
                    break;

                case 'integer':
                case 'float':
                case 'int64':
                case 'float64':
                case 'number':
                    return this.renderNumber(this.props.value as number);
                    break;

                default:
                    break;
            }
        }

        // Otherwise an unknown type or a string
        const val = this.props.value !== null ? this.props.value.toString() : '';
        return (<div title={val}>{val}</div>);
    }

    private renderBool(value: boolean) {
        return <span>{value.toString()}</span>;
    }

    private renderNumber(value: number) {
        const val = value.toString();
        return <div className='number-formatter' title={val}><span>{val}</span></div>;
    }

}
