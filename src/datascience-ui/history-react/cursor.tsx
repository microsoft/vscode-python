// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as React from 'react';
import './commandPrompt.css';


interface ICursorState {
    show: boolean;
}

export class Cursor extends React.Component<{}, ICursorState> {

    private registered: boolean = false;

    constructor(props) {
        super(props);
        this.state = {show: true};
    }

    public componentDidMount() {
        if (!this.registered) {
            this.registered = true;
            window.addEventListener('onfocusin', this.focusGained);
            window.addEventListener('onfocusout', this.focusLost);
        }
    }

    public componentWillUnmount() {
        if (this.registered) {
            this.registered = false;
            window.removeEventListener('onfocusin', this.focusGained);
            window.removeEventListener('onfocusout', this.focusLost);
        }
    }


    public render() {
        const nonFocusClass = document.hasFocus() ? '' : 'CodeMirror-cursor cursor-top';
        return <div className={nonFocusClass}></div>
    }

    private focusGained = () => {
        this.setState({show: false});
    }

    private focusLost = () => {
        this.setState({show: true});
    }

}
