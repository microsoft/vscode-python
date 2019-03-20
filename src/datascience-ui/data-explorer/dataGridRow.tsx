// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import * as AdazzleReactDataGrid from 'react-data-grid';

export class DataGridRowRenderer extends AdazzleReactDataGrid.Row {

    // tslint:disable:no-any
    constructor(props: any) {
        super(props);
    }

    public render = () => {
        const parent = super.render();
        if (super.props.idx) {
            const style: React.CSSProperties = {
                color: super.props.idx % 2 ? 'red' : 'blue'
            };
            return <div id='wrapper' style={style}>{parent}</div>;
        }

        return parent;
    }
}
