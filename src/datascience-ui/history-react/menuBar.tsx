// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import './menuBar.css';

import * as React from 'react';

interface IMenuBarProps {
    baseTheme: string;
}

// Simple 'bar'. Came up with the css by playing around here:
// https://www.w3schools.com/cssref/tryit.asp?filename=trycss_float
export class MenuBar extends React.Component<IMenuBarProps> {
    constructor(props: IMenuBarProps) {
        super(props);
    }

    public render() {
        return (
            <div className='menuBar'>
                {this.props.children}
            </div>
        );
    }
}
