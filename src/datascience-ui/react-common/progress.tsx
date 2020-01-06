// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './progress.css';

import * as React from 'react';

export class Progress extends React.Component {
    constructor(props: {}) {
        super(props);
    }

    public render() {
        // Vscode does this with two parts, a progress container and a progress bit
        return (
            <div className="monaco-progress-container active infinite">
                <div className="progress-bit" />
            </div>
        );
    }
}
