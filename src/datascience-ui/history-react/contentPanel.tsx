// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './contentPanel.css';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { noop } from '../../test/core';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { getSettings } from '../react-common/settingsReactSide';
import { Cell, ICellViewModel } from './cell';
import { InputHistory } from './inputHistory';

export interface IContentPanelProps {
    baseTheme: string;
    cellVMs: ICellViewModel[];
    history: InputHistory;
    testMode?: boolean;
    codeTheme: string;
    submittedText: boolean;
    skipNextScroll: boolean;
    monacoTheme: string | undefined;
    editorOptions: monacoEditor.editor.IEditorOptions;
    gotoCellCode(index: number): void;
    deleteCell(index: number): void;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
}

export class ContentPanel extends React.Component<IContentPanelProps> {
    private bottomRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    constructor(prop: IContentPanelProps) {
        super(prop);
    }

    public componentDidMount() {
        this.scrollToBottom();
    }

    public componentDidUpdate() {
        this.scrollToBottom();
    }

    public render() {
        return(
            <div id='content-panel-div'>
                <div id='cell-table'>
                    <div id='cell-table-body'>
                        {this.renderCells()}
                    </div>
                </div>
                <div ref={this.bottomRef}/>
            </div>
        );
    }

    private renderCells = () => {
        const maxOutputSize = getSettings().maxOutputSize;
        const errorBackgroundColor = getSettings().errorBackgroundColor;
        const actualErrorBackgroundColor = errorBackgroundColor ? errorBackgroundColor : '#FFFFFF';
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;
        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) =>
            <ErrorBoundary key={index}>
                <Cell
                    editorOptions={this.props.editorOptions}
                    history={undefined}
                    maxTextSize={maxTextSize}
                    autoFocus={false}
                    testMode={this.props.testMode}
                    cellVM={cellVM}
                    submitNewCode={noop}
                    baseTheme={baseTheme}
                    codeTheme={this.props.codeTheme}
                    showWatermark={false}
                    editExecutionCount={0}
                    errorBackgroundColor={actualErrorBackgroundColor}
                    gotoCode={() => this.props.gotoCellCode(index)}
                    delete={() => this.props.deleteCell(index)}
                    onCodeChange={this.props.onCodeChange}
                    onCodeCreated={this.props.onCodeCreated}
                    monacoTheme={this.props.monacoTheme}
                    />
            </ErrorBoundary>
        );
    }

    private scrollToBottom = () => {
        if (this.bottomRef.current && !this.props.skipNextScroll && !this.props.testMode) {
            // Force auto here as smooth scrolling can be canceled by updates to the window
            // from elsewhere (and keeping track of these would make this hard to maintain)
            this.bottomRef.current.scrollIntoView({behavior: 'auto', block: 'start', inline: 'nearest'});
        }
    }

}
