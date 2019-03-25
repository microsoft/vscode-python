// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as React from 'react';

interface IBooleanProps {
    value: boolean;
}

export class BooleanColumnFormatter extends React.Component<IBooleanProps> {
    constructor(props: IBooleanProps) {
        super(props);
    }

    public render() {
        return (
            <span>{this.props.value.toString()}</span>
        );
    }

}
