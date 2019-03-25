// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as AdazzleReactDataGrid from 'react-data-grid';

export class DataGridRowRenderer extends AdazzleReactDataGrid.Row {

    // tslint:disable:no-any
    constructor(props: any) {
        super(props);
    }

    public render = () => {
        return super.render();
        // if (this.props.idx) {
        //     const style: React.CSSProperties = {
        //         color: this.props.idx % 2 ? 'red' : 'blue'
        //     };
        //     return <div id='wrapper' style={style}>{parent}</div>;
        // }
    }
}
