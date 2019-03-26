// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './cellFormatter.css';

import { JSONObject } from '@phosphor/coreutils';
import * as React from 'react';
import { DataExplorerRowStates } from '../../client/datascience/data-viewing/types';

interface IProps {
    value: string | number | object | boolean;
    row: JSONObject | string;
    dependentValues: string | undefined;
}

export class CellFormatter extends React.Component<IProps> {
    constructor(props: IProps) {
        super(props);
    }

    public render() {
        // Render based on type
        if (this.props.dependentValues && this.props.value !== null && this.props.row !== 'not-set') {
            switch (this.props.dependentValues) {
                case 'bool':
                    return this.renderBool(this.props.value as boolean);
                    break;

                case 'integer':
                case 'float':
                case 'int64':
                case 'float64':
                    return this.renderNumber(this.props.value as number);
                    break;

                default:
                    break;
            }
        }

        // If this is our special not set value, render a 'loading ...' value.
        if (this.props.row === DataExplorerRowStates.Skipped || this.props.row === DataExplorerRowStates.Fetching) {
            return (<span>loading ...</span>);
        }

        // Otherwise an unknown type
        return (<div>{this.props.value}</div>);
    }

    private renderBool(value: boolean) {
        return <span>{value.toString()}</span>;
    }

    private renderNumber(value: number) {
        return <div className='number-formatter'><span>{value.toString()}</span></div>;
    }

}
