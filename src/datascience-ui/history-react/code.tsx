// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/python/python';

import * as React from 'react';
import * as RCM from 'react-codemirror';

import './code.css';

export interface ICodeProps {
    code : string;
    codeTheme: string;
}

export class Code extends React.Component<ICodeProps> {

    private codeMirror: CodeMirror.Editor | undefined;

    constructor(prop: ICodeProps) {
        super(prop);
    }

    public componentDidUpdate = () => {
        // Force our new value
        if (this.codeMirror) {
            this.codeMirror.setValue(this.props.code);
        }
    }

    public render() {
        return (
        <RCM
            className='code-readonly'
            value={this.props.code}
            autoFocus={false}
            options={
                {
                    mode: 'python',
                    readOnly: 'nocursor',
                    theme: `${this.props.codeTheme} default`,
                    viewportMargin: 0,
                    cursorBlinkRate: -1
                }
            }
            ref={this.updateCodeMirror}
        />
    );
    }

    private updateCodeMirror = (rcm: ReactCodeMirror.ReactCodeMirror) => {
        if (rcm) {
            this.codeMirror = rcm.getCodeMirror();
        }
    }
}
