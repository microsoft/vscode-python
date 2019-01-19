// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import './commandPrompt.css';

export class CommandPrompt extends React.Component {
    constructor(props) {
        super(props);
    }

    public render() {
        return <div className='command-prompt'>{'>>>'}</div>;
    }

}
