// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { Identifiers } from '../../client/datascience/constants';
import { CellState, ICell } from '../../client/datascience/types';
import { CellInput } from '../interactive-common/cellInput';
import { CellOutput } from '../interactive-common/cellOutput';
import { CollapseButton } from '../interactive-common/collapseButton';
import { ExecutionCount } from '../interactive-common/executionCount';
import { InformationMessages } from '../interactive-common/informationMessages';
import { InputHistory } from '../interactive-common/inputHistory';
import { IKeyboardEvent } from '../react-common/event';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';

// tslint:disable-next-line: no-require-imports
interface ICellProps {
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
    allowCollapse: boolean;
    selectedCell?: string;
    focusedCell?: string;
    allowsMarkdownEditing?: boolean;
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

export interface ICellViewModel {
    cell: ICell;
    inputBlockShow: boolean;
    inputBlockOpen: boolean;
    inputBlockText: string;
    inputBlockCollapseNeeded: boolean;
    editable: boolean;
    directInput?: boolean;
    showLineNumbers?: boolean;
    hideOutput?: boolean;
    useQuickEdit?: boolean;
    inputBlockToggled(id: string): void;
}

// tslint:disable: react-this-binding-issue
export class Cell extends React.Component<ICellProps> {
    private codeRef: React.RefObject<CellInput> = React.createRef<CellInput>();
    private cellWrapperRef : React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(prop: ICellProps) {
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

    public componentDidUpdate(prevProps: ICellProps) {
        if (this.props.selectedCell === this.props.cellVM.cell.id && prevProps.selectedCell !== this.props.selectedCell) {
            this.giveFocus(this.props.focusedCell === this.props.cellVM.cell.id);
        }
    }

    public giveFocus(giveCodeFocus: boolean) {
        // Start out with ourselves
        if (this.cellWrapperRef && this.cellWrapperRef.current) {
            this.cellWrapperRef.current.focus();
        }
        // Then attempt to move into the object
        if (giveCodeFocus) {
            // This depends upon what type of cell we are.
            if (this.props.cellVM.cell.data.cell_type === 'code') {
                if (this.codeRef.current) {
                    this.codeRef.current.giveFocus();
                }
            }
        }
    }

    // Public for testing
    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }

    private toggleInputBlock = () => {
        const cellId: string = this.getCell().id;
        this.props.cellVM.inputBlockToggled(cellId);
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    }

    private renderNormalCell() {
        const results: JSX.Element | null = this.renderResults();
        const allowsPlainInput = getSettings().showCellInputCode || this.props.cellVM.directInput || this.props.cellVM.editable;
        const shouldRender = allowsPlainInput || results;
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';
        let cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        if (this.props.selectedCell === this.props.cellVM.cell.id && this.props.focusedCell !== this.props.cellVM.cell.id) {
            cellWrapperClass += ' cell-wrapper-selected';
        }
        if (this.props.focusedCell === this.props.cellVM.cell.id) {
            cellWrapperClass += ' cell-wrapper-focused';
        }

        // Only render if we are allowed to.
        if (shouldRender) {
            return (
                <div className={cellWrapperClass} role={this.props.role} ref={this.cellWrapperRef} tabIndex={0} onKeyDown={this.onCellKeyDown} onClick={this.onMouseClick} onDoubleClick={this.onMouseDoubleClick}>
                    <div className={cellOuterClass}>
                        {this.renderControls()}
                        <div className='content-div'>
                            <div className='cell-result-container'>
                                {this.renderInput()}
                                {this.renderResultsDiv(results)}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Shouldn't be rendered because not allowing empty input and not a direct input cell
        return null;
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

    private renderControls = () => {
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const collapseVisible = (this.props.allowCollapse && this.props.cellVM.inputBlockCollapseNeeded && this.props.cellVM.inputBlockShow && !this.props.cellVM.editable && this.isCodeCell());
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '-';
        const isEditOnlyCell = this.props.cellVM.cell.id === Identifiers.EditCellId;

        return (
            <div className='controls-div'>
                <ExecutionCount isBusy={busy} count={isEditOnlyCell && this.props.editExecutionCount ? this.props.editExecutionCount : executionCount} visible={this.isCodeCell()} />
                <CollapseButton theme={this.props.baseTheme}
                    visible={collapseVisible}
                    open={this.props.cellVM.inputBlockOpen}
                    onClick={this.toggleInputBlock}
                    tooltip={getLocString('DataScience.collapseInputTooltip', 'Collapse input block')} />
                {this.props.renderCellToolbar(this.props.cellVM.cell.id)}
            </div>
        );
    }

    private renderInput = () => {
        if (this.isCodeCell()) {
            return (
                <div className='cell-input'>
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
                        ref={this.codeRef}
                        monacoTheme={this.props.monacoTheme}
                        openLink={this.props.openLink}
                        editorMeasureClassName={this.props.editorMeasureClassName}
                        focused={this.onCodeFocused}
                        unfocused={this.onCodeUnfocused}
                        keyDown={this.props.keyDown}
                        showLineNumbers={this.props.showLineNumbers}
                        />
                </div>
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

    private renderResultsDiv = (results: JSX.Element | null) => {

        // Only render results if not an edit cell
        if (this.props.cellVM.cell.id !== Identifiers.EditCellId) {
            const outputClassNames = this.isCodeCell() ?
                `cell-output cell-output-${this.props.baseTheme}` :
                '';

            // Then combine them inside a div
            return <div className={outputClassNames}>{results}</div>;
        }
        return null;
    }

    private renderResults = (): JSX.Element | null => {
        if (this.isCodeCell() || this.props.cellVM.cell.id !== Identifiers.EditCellId) {
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
