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
// tslint:disable-next-line:no-require-imports no-var-requires
const throttle = require('lodash/throttle') as typeof import('lodash/throttle');

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
    copyCellCode(index: number): void;
    deleteCell(index: number): void;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
    expandImage(imageHtml: string): void;
}

export class ContentPanel extends React.Component<IContentPanelProps> {
    private bottomRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private containerRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private cellRefs: Map<string, React.RefObject<HTMLDivElement>> = new Map<string, React.RefObject<HTMLDivElement>>();
    private throttledScrollIntoView = throttle(this.scrollIntoView.bind(this), 100);
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
            <div id='content-panel-div' ref={this.containerRef}>
                <div id='cell-table'>
                    <div id='cell-table-body' role='list'>
                        {this.renderCells()}
                    </div>
                </div>
                <div ref={this.bottomRef}/>
            </div>
        );
    }

    public scrollToCell(cellId: string) {
        const ref = this.cellRefs.get(cellId);
        if (ref && ref.current) {
            ref.current.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
            ref.current.classList.add('flash');
            setTimeout(() => {
                if (ref.current) {
                    ref.current.classList.remove('flash');
                }
            }, 1000);
        }
    }

    private renderCells = () => {
        const maxOutputSize = getSettings().maxOutputSize;
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;

        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) => {
            const ref = React.createRef<HTMLDivElement>();
            this.cellRefs.set(cellVM.cell.id, ref);
            return (
                <div key={index} id={cellVM.cell.id} ref={ref}>
                    <ErrorBoundary key={index}>
                        <Cell
                            role='listitem'
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
                            gotoCode={() => this.props.gotoCellCode(index)}
                            copyCode={() => this.props.copyCellCode(index)}
                            delete={() => this.props.deleteCell(index)}
                            onCodeChange={this.props.onCodeChange}
                            onCodeCreated={this.props.onCodeCreated}
                            monacoTheme={this.props.monacoTheme}
                            openLink={this.props.openLink}
                            expandImage={this.props.expandImage}
                        />
                    </ErrorBoundary>
                </div>);
        }
        );
    }

    private scrollIntoView() {
        // Force auto here as smooth scrolling can be canceled by updates to the window
        // from elsewhere (and keeping track of these would make this hard to maintain)
        if (this.bottomRef.current) {
            this.bottomRef.current.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
        }
    }

    private scrollToBottom() {
        if (this.bottomRef.current && !this.props.skipNextScroll && !this.props.testMode && this.containerRef.current) {
            // Make sure to debounce this so it doesn't take up too much time.
            this.throttledScrollIntoView();
        }
    }

}
