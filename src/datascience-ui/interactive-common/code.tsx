// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { InputHistory } from '../interactive-common/inputHistory';
import { IKeyboardEvent } from '../react-common/event';
import { getLocString } from '../react-common/locReactSide';
import { IMonacoModelContentChangeEvent } from '../react-common/monacoHelpers';
import { Editor } from './editor';
import { CursorPos, IFont } from './mainState';

export interface ICodeProps {
    code: string;
    version: number;
    codeTheme: string;
    testMode: boolean;
    readOnly: boolean;
    history: InputHistory | undefined;
    showWatermark: boolean;
    monacoTheme: string | undefined;
    outermostParentClass: string;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    editorMeasureClassName?: string;
    showLineNumbers?: boolean;
    useQuickEdit?: boolean;
    font: IFont;
    hasFocus: boolean;
    cursorPos: CursorPos | monacoEditor.IPosition;
    disableUndoStack: boolean;
    focusPending: number;
    onCreated(code: string, modelId: string): void;
    onChange(e: IMonacoModelContentChangeEvent): void;
    openLink(uri: monacoEditor.Uri): void;
    keyDown?(e: IKeyboardEvent): void;
    focused?(): void;
    unfocused?(): void;
}

interface ICodeState {
    allowWatermark: boolean;
}

export class Code extends React.Component<ICodeProps, ICodeState> {
    private editorRef: React.RefObject<Editor> = React.createRef<Editor>();

    constructor(prop: ICodeProps) {
        super(prop);
        this.state = { allowWatermark: true };
    }

    public componentDidUpdate(prevProps: ICodeProps) {
        if (prevProps.focusPending !== this.props.focusPending) {
            this.giveFocus(CursorPos.Current);
        }
    }

    public render() {
        const readOnly = this.props.readOnly;
        const waterMarkClass =
            this.props.showWatermark && this.state.allowWatermark && !readOnly ? 'code-watermark' : 'hide';
        const classes = readOnly ? 'code-area' : 'code-area code-area-editable';

        return (
            <div className={classes}>
                <Editor
                    codeTheme={this.props.codeTheme}
                    readOnly={readOnly}
                    history={this.props.history}
                    onCreated={this.props.onCreated}
                    onChange={this.onModelChanged}
                    testMode={this.props.testMode}
                    content={this.props.code}
                    outermostParentClass={this.props.outermostParentClass}
                    monacoTheme={this.props.monacoTheme}
                    language="python"
                    editorOptions={this.props.editorOptions}
                    openLink={this.props.openLink}
                    ref={this.editorRef}
                    editorMeasureClassName={this.props.editorMeasureClassName}
                    keyDown={this.props.keyDown}
                    hasFocus={this.props.hasFocus}
                    cursorPos={this.props.cursorPos}
                    focused={this.props.focused}
                    unfocused={this.props.unfocused}
                    showLineNumbers={this.props.showLineNumbers}
                    useQuickEdit={this.props.useQuickEdit}
                    font={this.props.font}
                    disableUndoStack={this.props.disableUndoStack}
                    version={this.props.version}
                />
                <div className={waterMarkClass} role="textbox" onClick={this.clickWatermark}>
                    {this.getWatermarkString()}
                </div>
            </div>
        );
    }

    public getContents(): string | undefined {
        if (this.editorRef.current) {
            return this.editorRef.current.getContents();
        }
    }

    private giveFocus(cursorPos: CursorPos) {
        if (this.editorRef && this.editorRef.current) {
            this.editorRef.current.giveFocus(cursorPos);
        }
    }

    private clickWatermark = (ev: React.MouseEvent<HTMLDivElement>) => {
        ev.stopPropagation();
        // Give focus to the editor
        this.giveFocus(CursorPos.Current);
    };

    private getWatermarkString = (): string => {
        return getLocString('DataScience.inputWatermark', 'Type code here and press shift-enter to run');
    };

    private onModelChanged = (e: IMonacoModelContentChangeEvent) => {
        if (!this.props.readOnly && e.model) {
            this.setState({ allowWatermark: e.model.getValueLength() === 0 });
        }
        this.props.onChange(e);
    };
}
