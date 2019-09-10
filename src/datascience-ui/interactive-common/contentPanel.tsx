// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { ErrorBoundary } from '../react-common/errorBoundary';
import { IKeyboardEvent } from '../react-common/event';
import { getSettings } from '../react-common/settingsReactSide';
import { Cell, ICellViewModel } from './cell';
import { InputHistory } from './inputHistory';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
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
    editorOptions?: monacoEditor.editor.IEditorOptions;
    editable: boolean;
    editExecutionCount?: string;
    editorMeasureClassName?: string;
    newCellVM?: ICellViewModel;
    selectedCell?: string;
    focusedCell?: string;
    allowsMarkdownEditing?: boolean;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
    expandImage(imageHtml: string): void;
    selectCell?(cellId: string): void;
    clickCell?(cellId: string): void;
    doubleClickCell?(cellId: string): void;
    focusCell?(cellId: string): void;
    unfocusCell?(cellId: string): void;
    keyDownCell?(cellId: string, e: IKeyboardEvent): void;
    renderCellToolbar(cellId: string): JSX.Element[] | null;
    onRenderCompleted?(cells: (HTMLDivElement | null)[]): void;
    scrollToBottom(div: HTMLDivElement): void;
}

export class ContentPanel extends React.Component<IContentPanelProps> {
    private bottomRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private containerRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private cellRefs: Map<string, React.RefObject<Cell>> = new Map<string, React.RefObject<Cell>>();
    private cellContainerRefs: Map<string, React.RefObject<HTMLDivElement>> = new Map<string, React.RefObject<HTMLDivElement>>();
    private throttledScrollIntoView = throttle(this.scrollIntoView.bind(this), 100);
    constructor(prop: IContentPanelProps) {
        super(prop);
    }

    public componentDidMount() {
        this.scrollToBottom();

        // Indicate we completed our first render
        if (this.props.onRenderCompleted && this.cellContainerRefs.values) {
            const values = Array.from(this.cellContainerRefs.values()).map(c => c.current);
            this.props.onRenderCompleted(values);
        }
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
                        {this.renderEdit()}
                    </div>
                </div>
                <div ref={this.bottomRef}/>
            </div>
        );
    }

    public scrollToCell(cellId: string) {
        const ref = this.cellContainerRefs.get(cellId);
        if (ref && ref.current) {
            ref.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            ref.current.classList.add('flash');
            setTimeout(() => {
                if (ref.current) {
                    ref.current.classList.remove('flash');
                }
            }, 1000);
        }
    }

    public focusCell(cellId: string, focusCode: boolean) {
        const ref = this.cellContainerRefs.get(cellId);
        if (ref && ref.current) {
            ref.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            const cellRef = this.cellRefs.get(cellId);
            if (cellRef && cellRef.current) {
                cellRef.current.giveFocus(focusCode);
            }
        }
    }

    private renderCells = () => {
        const maxOutputSize = getSettings().maxOutputSize;
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;

        return this.props.cellVMs.map((cellVM: ICellViewModel, index: number) =>
            this.renderCell(cellVM, index, baseTheme, maxTextSize, false));
    }

    private renderEdit = () => {
        if (this.props.editable && this.props.newCellVM) {
            const maxOutputSize = getSettings().maxOutputSize;
            const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
            const baseTheme = getSettings().ignoreVscodeTheme ? 'vscode-light' : this.props.baseTheme;
            return this.renderCell(this.props.newCellVM, 0, baseTheme, maxTextSize, true);
        } else {
            return null;
        }
    }

    private renderCell(cellVM: ICellViewModel, index: number, baseTheme: string, maxTextSize: number | undefined, showWatermark: boolean): JSX.Element {
        const cellRef = React.createRef<Cell>();
        const ref = React.createRef<HTMLDivElement>();
        this.cellRefs.set(cellVM.cell.id, cellRef);
        this.cellContainerRefs.set(cellVM.cell.id, ref);
        return (
            <div key={index} id={cellVM.cell.id} ref={ref}>
                <ErrorBoundary key={index}>
                    <Cell
                        ref={cellRef}
                        role='listitem'
                        editorOptions={this.props.editorOptions}
                        history={undefined}
                        maxTextSize={maxTextSize}
                        autoFocus={false}
                        testMode={this.props.testMode}
                        cellVM={cellVM}
                        baseTheme={baseTheme}
                        codeTheme={this.props.codeTheme}
                        allowCollapse={!this.props.editable}
                        showWatermark={showWatermark}
                        editExecutionCount={this.props.editExecutionCount}
                        onCodeChange={this.props.onCodeChange}
                        onCodeCreated={this.props.onCodeCreated}
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        expandImage={this.props.expandImage}
                        editorMeasureClassName={this.props.editorMeasureClassName}
                        selectedCell={this.props.selectedCell}
                        focusedCell={this.props.focusedCell}
                        onClick={this.props.clickCell}
                        focused={this.props.focusCell}
                        unfocused={this.props.unfocusCell}
                        keyDown={this.props.keyDownCell}
                        allowsMarkdownEditing={this.props.allowsMarkdownEditing}
                        onDoubleClick={this.props.doubleClickCell}
                        renderCellToolbar={this.props.renderCellToolbar}
                        showLineNumbers={cellVM.showLineNumbers}
                        hideOutput={cellVM.hideOutput}
                    />
                </ErrorBoundary>
            </div>);
    }

    private scrollIntoView() {
        if (this.bottomRef.current && this.props.scrollToBottom) {
            this.props.scrollToBottom(this.bottomRef.current);
        }
    }

    private scrollToBottom() {
        if (this.bottomRef.current && !this.props.skipNextScroll && !this.props.testMode && this.containerRef.current) {
            // Make sure to debounce this so it doesn't take up too much time.
            this.throttledScrollIntoView();
        }
    }

}
