// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './cellFormatter.css';

import { JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import { DataViewerRowStates } from '../../client/datascience/data-viewing/types';
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
        if (this.props.row === DataViewerRowStates.Skipped || this.props.row === DataViewerRowStates.Fetching) {
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
        return (<div className='cell-formatter' title={val}><span>{val}</span></div>);
    }

    private renderBool(value: boolean) {
        return <div className='cell-formatter' title={value.toString()}><span>{value.toString()}</span></div>;
    }

    private renderNumber(value: number) {
        const val = value.toString();
        return <div className='number-formatter cell-formatter' title={val}><span>{val}</span></div>;
    }

}
