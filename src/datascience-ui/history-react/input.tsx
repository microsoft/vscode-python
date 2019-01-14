// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/python/python';

import * as CodeMirror from 'codemirror';
import * as React from 'react';
import * as RCM from 'react-codemirror';

import './code.css';
import './input.css';

import { InputHistory } from './inputHistory';

interface IInputProps {
    codeTheme: string;
    testMode: boolean;
    onSubmit(code: string): void;
    onChangeLineCount(lineCount: number) : void;
}

export class Input extends React.Component<IInputProps> {
    private history : InputHistory;
    private baseIndentation : number | undefined;

    constructor(props: Readonly<IInputProps>) {
        super(props);
        this.history = new InputHistory();
    }

    public render() {
        return (
            <div className='input-outer' >
                <div className='input-area input-fold'>
                    <RCM
                        autoFocus={true}
                        onChange={this.onChange}
                        options={
                            {
                                extraKeys:
                                {
                                    Down    : this.arrowDown,
                                    Enter   : this.enter,
                                    Up      : this.arrowUp
                                },
                                theme: `${this.props.codeTheme} default`,
                                mode: 'python',
                                cursorBlinkRate : this.props.testMode ? -1 : 530,
                                readOnly: this.props.testMode ? 'nocursor' : false
                            }
                        }
                        />
                </div>
            </div>);
    }

    private getBaseIndentation(instance: CodeMirror.Editor) : number {
        if (!this.baseIndentation) {
            const option = instance.getOption('indentUnit');
            if (option) {
                this.baseIndentation = parseInt(option.toString(), 10);
            } else {
                this.baseIndentation = 2;
            }
        }
        return this.baseIndentation;
    }

    private expectedIndent(instance: CodeMirror.Editor, line: number) : number {
        // Expected should be indent on the previous line and one more if line
        // ends with :
        const doc = instance.getDoc();
        const baseIndent = this.getBaseIndentation(instance);
        const lineStr = doc.getLine(line).trimRight();
        const lastChar = lineStr.length === 0 ? null : lineStr.charAt(lineStr.length - 1);
        const frontIndent = lineStr.length - lineStr.trimLeft().length;
        return frontIndent + (lastChar === ':' ? baseIndent : 0);
    }

    private enter = (instance: CodeMirror.Editor) => {
        // See if the cursor is at the end or not
        const doc = instance.getDoc();
        const cursor = doc.getCursor();
        const lastLine = doc.lastLine();
        if (cursor.line === lastLine) {

            // Check for an empty line or no ':' on the first line.
            const lastLineStr = doc.getLine(lastLine).trimRight();
            const lastChar = lastLineStr.length === 0 ? null : lastLineStr.charAt(lastLineStr.length - 1);
            if (lastChar === null || (lastChar !== ':' && cursor.line === 0)) {
                const code = doc.getValue();

                // We have to clear the history as this CodeMirror doesn't go away.
                doc.clearHistory();
                doc.setValue('');
                this.props.onSubmit(code);
                return;
            }
        }

        // Otherwise add a line and indent the appropriate amount
        const expectedIndents = this.expectedIndent(instance, cursor.line);
        const indentString = Array(expectedIndents + 1).join(' ');
        doc.replaceRange(`\n${indentString}`, { line: cursor.line, ch: doc.getLine(cursor.line).length });
        doc.setCursor({line: cursor.line + 1, ch: indentString.length});

        // Tell our listener we added a new line
        this.props.onChangeLineCount(doc.lineCount());
    }

    private arrowUp = (instance: CodeMirror.Editor) => {
        if (instance.getDoc().getCursor().line === 0) {
            instance.getDoc().setValue(this.history.completeUp());
        }
        return CodeMirror.Pass;
    }

    private arrowDown = (instance: CodeMirror.Editor) => {
        if (instance.getDoc().getCursor().line === 0 && instance.getDoc().lineCount() <= 1) {
            instance.getDoc().setValue(this.history.completeDown());
        }
        return CodeMirror.Pass;
    }

    private onChange = (newValue: string, change: CodeMirror.EditorChange) => {
        // Do nothing
    }

}
