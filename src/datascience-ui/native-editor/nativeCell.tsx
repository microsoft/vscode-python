// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { Identifiers } from '../../client/datascience/constants';
import { CellState } from '../../client/datascience/types';
import { CellInput } from '../interactive-common/cellInput';
import { CellOutput } from '../interactive-common/cellOutput';
import { ExecutionCount } from '../interactive-common/executionCount';
import { InformationMessages } from '../interactive-common/informationMessages';
import { InputHistory } from '../interactive-common/inputHistory';
import { ICellViewModel } from '../interactive-common/mainState';
import { IKeyboardEvent } from '../react-common/event';
import { getLocString } from '../react-common/locReactSide';

// tslint:disable-next-line: no-require-imports
interface INativeCellProps {
    role?: string;
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    history: InputHistory | undefined;
    showWatermark: boolean;
    monacoTheme: string | undefined;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    editExecutionCount?: string;
    editorMeasureClassName?: string;
    selectedCell?: string;
    focusedCell?: string;
    hideOutput?: boolean;
    showLineNumbers?: boolean;
    onCodeChange(changes: monacoEditor.editor.IModelContentChange[], cellId: string, modelId: string): void;
    onCodeCreated(code: string, file: string, cellId: string, modelId: string): void;
    openLink(uri: monacoEditor.Uri): void;
    expandImage(imageHtml: string): void;
    keyDown?(cellId: string, e: IKeyboardEvent): void;
    onClick?(cellId: string): void;
    onDoubleClick?(cellId: string): void;
    focused?(cellId: string): void;
    unfocused?(cellId: string): void;
    renderCellToolbar(cellId: string): JSX.Element[] | null;
}

interface INativeCellState {
    showingMarkdownEditor: boolean;
}
// tslint:disable: react-this-binding-issue
export class NativeCell extends React.Component<INativeCellProps, INativeCellState> {
    private inputRef: React.RefObject<CellInput> = React.createRef<CellInput>();
    private wrapperRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(prop: INativeCellProps) {
        super(prop);
        this.state = { showingMarkdownEditor: false };
    }

    public render() {
        if (this.props.cellVM.cell.data.cell_type === 'messages') {
            return <InformationMessages messages={this.props.cellVM.cell.data.messages} type={this.props.cellVM.cell.type}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    public componentDidUpdate(prevProps: INativeCellProps) {
        if (this.props.selectedCell === this.props.cellVM.cell.id && prevProps.selectedCell !== this.props.selectedCell) {
            this.giveFocus(this.props.focusedCell === this.props.cellVM.cell.id);
        }
    }

    public giveFocus(giveCodeFocus: boolean) {
        // Start out with ourselves
        if (this.wrapperRef && this.wrapperRef.current) {
            this.wrapperRef.current.focus();
        }
        // Then attempt to move into the object
        if (giveCodeFocus) {
            if (this.inputRef && this.inputRef.current) {
                this.inputRef.current.giveFocus();
            }
            if (this.isMarkdownCell()) {
                this.setState({showingMarkdownEditor: true});
            }
        }
    }

    // Public for testing
    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    }

    private isMarkdownCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'markdown';
    }

    private renderNormalCell() {
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';
        let cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        if (this.props.selectedCell === this.props.cellVM.cell.id && this.props.focusedCell !== this.props.cellVM.cell.id) {
            cellWrapperClass += ' cell-wrapper-selected';
        }
        if (this.props.focusedCell === this.props.cellVM.cell.id) {
            cellWrapperClass += ' cell-wrapper-focused';
        }

        return (
            <div className={cellWrapperClass} role={this.props.role} ref={this.wrapperRef} tabIndex={0} onKeyDown={this.onCellKeyDown} onClick={this.onMouseClick} onDoubleClick={this.onMouseDoubleClick}>
                <div className={cellOuterClass}>
                    {this.renderControls()}
                    <div className='content-div'>
                        <div className='cell-result-container'>
                            {this.renderInput()}
                            {this.renderResultsDiv(this.renderResults())}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private onMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive a click, propagate upwards. Might change our state
        if (this.props.onClick) {
            ev.stopPropagation();
            this.props.onClick(this.props.cellVM.cell.id);
        }
    }

    private onMouseDoubleClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive double click, propagate upwards. Might change our state
        if (this.props.onDoubleClick) {
            ev.stopPropagation();
            this.props.onDoubleClick(this.props.cellVM.cell.id);
        }
    }

    private shouldRenderCodeEditor = () : boolean => {
        return (this.isCodeCell() && (this.props.cellVM.inputBlockShow || this.props.cellVM.editable));
    }

    private shouldRenderMarkdownEditor = () : boolean => {
        return (this.isMarkdownCell() && (this.state.showingMarkdownEditor || this.props.cellVM.cell.id === Identifiers.EditCellId));
    }

    private shouldRenderInput(): boolean {
       return this.shouldRenderCodeEditor() || this.shouldRenderMarkdownEditor();
    }

    private hasOutput = () => {
        return this.getCell().state === CellState.finished || this.getCell().state === CellState.error || this.getCell().state === CellState.executing;
    }

    private getCodeCell = () => {
        return this.props.cellVM.cell.data as nbformat.ICodeCell;
    }

    private shouldRenderOutput(): boolean {
        if (this.isCodeCell()) {
            return this.hasOutput() && this.getCodeCell().outputs && !this.props.hideOutput;
        } else if (this.isMarkdownCell()) {
            return !this.state.showingMarkdownEditor;
        }
        return false;
    }

    private renderControls = () => {
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '-';
        const isEditOnlyCell = this.props.cellVM.cell.id === Identifiers.EditCellId;

        return (
            <div className='controls-div'>
                <ExecutionCount isBusy={busy} count={isEditOnlyCell && this.props.editExecutionCount ? this.props.editExecutionCount : executionCount} visible={this.isCodeCell()} />
                {this.props.renderCellToolbar(this.props.cellVM.cell.id)}
            </div>
        );
    }

    private renderInput = () => {
        if (this.shouldRenderInput()) {
            return (
                <CellInput
                    cellVM={this.props.cellVM}
                    editorOptions={this.props.editorOptions}
                    history={this.props.history}
                    autoFocus={this.props.autoFocus}
                    codeTheme={this.props.codeTheme}
                    onCodeChange={this.props.onCodeChange}
                    onCodeCreated={this.props.onCodeCreated}
                    testMode={this.props.testMode ? true : false}
                    showWatermark={this.props.showWatermark}
                    ref={this.inputRef}
                    monacoTheme={this.props.monacoTheme}
                    openLink={this.props.openLink}
                    editorMeasureClassName={this.props.editorMeasureClassName}
                    focused={this.isCodeCell() ? this.onCodeFocused : this.onMarkdownFocused}
                    unfocused={this.isCodeCell() ? this.onCodeUnfocused : this.onMarkdownUnfocused}
                    keyDown={this.props.keyDown}
                    showLineNumbers={this.props.showLineNumbers}
                />
            );
        }
        return null;
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

    private renderResultsDiv = (results: JSX.Element | null) => {

        // Only render results if not an edit cell
        if (this.props.cellVM.cell.id !== Identifiers.EditCellId) {
            return results;
        }
        return null;
    }

    private renderResults = (): JSX.Element | null => {
        if (this.shouldRenderOutput()) {
            return (
                <CellOutput
                    cellVM={this.props.cellVM}
                    baseTheme={this.props.baseTheme}
                    expandImage={this.props.expandImage}
                    openLink={this.props.openLink}
                 />
            );
        }
        return null;
    }

    private onCellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Handle keydown events for the entire cell
        if (this.props.keyDown && event.key !== 'Tab') {
            this.props.keyDown(
                this.props.cellVM.cell.id,
                {
                    code: event.key,
                    shiftKey: event.shiftKey,
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                    altKey: event.altKey,
                    target: event.target as HTMLDivElement,
                    stopPropagation: () => event.stopPropagation(),
                    preventDefault: () => event.preventDefault()
                });
        }
    }

}
