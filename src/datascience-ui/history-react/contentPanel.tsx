// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './contentPanel.css';

import * as React from 'react';

export interface IContentPanelProps {
    baseTheme: string;
}

interface IContentPanelState {
}

export class ContentPanel extends React.Component<IContentPanelProps, IContentPanelState> {
    constructor(prop: IContentPanelProps) {
        super(prop);
        //this.state = { open: false,
                        //gridColumns: columns,
                        //gridRows: [],
                        //gridHeight: 200};
    }

    public render() {
        return(
            <div className='content-panel-div'>
            </div>
        );
    }
}
