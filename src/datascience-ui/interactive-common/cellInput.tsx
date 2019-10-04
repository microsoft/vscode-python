// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { concatMultilineString } from '../../client/datascience/common';
import { IKeyboardEvent } from '../react-common/event';
import { getLocString } from '../react-common/locReactSide';
import { Code } from './code';
import { InputHistory } from './inputHistory';
import { ICellViewModel, IFont } from './mainState';
import { Markdown } from './markdown';

// tslint:disable-next-line: no-require-importss
interface ICellInputProps {
    cellVM: ICellViewModel;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    history: InputHistory | undefined;
    showWatermark: boolean;
    monacoTheme: string | undefined;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    editorMeasureClassName?: string;
    focusedCell?: string;
    showLineNumbers?: boolean;
    font: IFont;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
    keyDown?(cellId: string, e: IKeyboardEvent): void;
    focused?(cellId: string): void;
    unfocused?(cellId: string): void;
}

// tslint:disable: react-this-binding-issue
export class CellInput extends React.Component<ICellInputProps> {
    private codeRef: React.RefObject<Code> = React.createRef<Code>();
    private markdownRef: React.RefObject<Markdown> = React.createRef<Markdown>();

    constructor(prop: ICellInputProps) {
        super(prop);
        this.state = { showingMarkdownEditor: false };
    }

    public render() {
        if (this.isCodeCell()) {
            return this.renderCodeInputs();
        } else {
            return this.renderMarkdownInputs();
        }
    }

    public componentDidUpdate(prevProps: ICellInputProps) {
        if (this.props.focusedCell === this.props.cellVM.cell.id && prevProps.focusedCell !== this.props.focusedCell) {
            this.giveFocus();
        }
    }

    public giveFocus() {
        // This depends upon what type of cell we are.
        if (this.props.cellVM.cell.data.cell_type === 'code') {
            if (this.codeRef.current) {
                this.codeRef.current.giveFocus();
            }
        } else {
            if (this.markdownRef.current) {
                this.markdownRef.current.giveFocus();
            }
            this.setState({ showingMarkdownEditor: true });
        }
    }

    // Public for testing
    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    }

    private isMarkdownCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'markdown';
    }

    private getMarkdownCell = () => {
        return this.props.cellVM.cell.data as nbformat.IMarkdownCell;
    }

    private shouldRenderCodeEditor = () : boolean => {
        return (this.isCodeCell() && (this.props.cellVM.inputBlockShow || this.props.cellVM.editable));
    }

    private shouldRenderMarkdownEditor = () : boolean => {
        return (this.isMarkdownCell());
    }

    private getRenderableInputCode = () : string => {
        return this.props.cellVM.inputBlockText;
    }

    private renderCodeInputs = () => {
        if (this.shouldRenderCodeEditor()) {
            return (
                <div className='cell-input'>
                    <Code
                        editorOptions={this.props.editorOptions}
                        history={this.props.history}
                        autoFocus={this.props.autoFocus}
                        code={this.getRenderableInputCode()}
                        codeTheme={this.props.codeTheme}
                        testMode={this.props.testMode ? true : false}
                        readOnly={!this.props.cellVM.editable}
                        showWatermark={this.props.showWatermark}
                        ref={this.codeRef}
                        onChange={this.onCodeChange}
                        onCreated={this.onCodeCreated}
                        outermostParentClass='cell-wrapper'
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        editorMeasureClassName={this.props.editorMeasureClassName}
                        focused={this.onCodeFocused}
                        unfocused={this.onCodeUnfocused}
                        keyDown={this.onKeyDown}
                        showLineNumbers={this.props.showLineNumbers}
                        useQuickEdit={this.props.cellVM.useQuickEdit}
                        font={this.props.font}
                        />
                </div>
            );
        }

        return null;
    }

    private renderMarkdownInputs = () => {
        if (this.shouldRenderMarkdownEditor()) {
            const source = concatMultilineString(this.getMarkdownCell().source);
            return (
                <div className='cell-input'>
                    <Markdown
                        editorOptions={this.props.editorOptions}
                        autoFocus={true}
                        markdown={source}
                        codeTheme={this.props.codeTheme}
                        testMode={this.props.testMode ? true : false}
                        onChange={this.onCodeChange}
                        onCreated={this.onCodeCreated}
                        outermostParentClass='cell-wrapper'
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        editorMeasureClassName={this.props.editorMeasureClassName}
                        focused={this.onMarkdownFocused}
                        unfocused={this.onMarkdownUnfocused}
                        keyDown={this.onKeyDown}
                        ref={this.markdownRef}
                        useQuickEdit={false}
                        font={this.props.font}
                        />
                </div>
            );
        }

        return null;
    }

    private onKeyDown = (e: IKeyboardEvent) => {
        if (this.props.keyDown) {
            this.props.keyDown(this.props.cellVM.cell.id, e);
        }
    }

    private onCodeFocused = () => {
        if (this.props.focused) {
            this.props.focused(this.props.cellVM.cell.id);
        }
    }

    private onCodeUnfocused = () => {
        if (this.props.unfocused) {
            this.props.unfocused(this.props.cellVM.cell.id);
        }
    }

    private onMarkdownFocused = () => {
        if (this.props.focused) {
            this.props.focused(this.props.cellVM.cell.id);
        }
    }

    private onMarkdownUnfocused = () => {
        if (this.props.unfocused) {
            this.props.unfocused(this.props.cellVM.cell.id);
        }

        // Indicate not showing the editor anymore. The equivalent of this
        // is not when we receive focus but when we GIVE focus to the markdown editor
        // otherwise we wouldn't be able to display it.
        this.setState({showingMarkdownEditor: false});
    }

    private onCodeChange = (changes: monacoEditor.editor.IModelContentChange[], modelId: string) => {
        this.props.onCodeChange(changes, this.props.cellVM.cell.id, modelId);
    }

    private onCodeCreated = (code: string, modelId: string) => {
        this.props.onCodeCreated(code, this.props.cellVM.cell.file, this.props.cellVM.cell.id, modelId);
    }

}
