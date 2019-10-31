// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as fastDeepEqual from 'fast-deep-equal';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { Identifiers } from '../../client/datascience/constants';
import { CellState } from '../../client/datascience/types';
import { CellInput } from '../interactive-common/cellInput';
import { CellOutput } from '../interactive-common/cellOutput';
import { CollapseButton } from '../interactive-common/collapseButton';
import { ExecutionCount } from '../interactive-common/executionCount';
import { InformationMessages } from '../interactive-common/informationMessages';
import { InputHistory } from '../interactive-common/inputHistory';
import { CursorPos, ICellViewModel, IFont } from '../interactive-common/mainState';
import { IKeyboardEvent } from '../react-common/event';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';

// tslint:disable-next-line: no-require-imports
interface IInteractiveCellProps {
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
    font: IFont;
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

// tslint:disable: react-this-binding-issue
export class InteractiveCell extends React.Component<IInteractiveCellProps> {
    private codeRef: React.RefObject<CellInput> = React.createRef<CellInput>();
    private wrapperRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(prop: IInteractiveCellProps) {
        super(prop);
        this.state = { showingMarkdownEditor: false };
    }

    public render() {

        if (this.props.cellVM.cell.data.cell_type === 'messages') {
            return <InformationMessages messages={this.props.cellVM.cell.data.messages}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    public componentDidUpdate(prevProps: IInteractiveCellProps) {
        if (this.props.cellVM.selected && !prevProps.cellVM.selected) {
            this.giveFocus(this.props.cellVM.focused);
        }
    }

    public shouldComponentUpdate(nextProps: IInteractiveCellProps): boolean {
        return !fastDeepEqual(this.props, nextProps);
    }

    public scrollAndFlash() {
        if (this.wrapperRef && this.wrapperRef.current) {
            this.wrapperRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            this.wrapperRef.current.classList.add('flash');
            setTimeout(() => {
                if (this.wrapperRef.current) {
                    this.wrapperRef.current.classList.remove('flash');
                }
            }, 1000);
        }
    }

    public giveFocus(giveCodeFocus: boolean) {
        // Start out with ourselves
        if (this.wrapperRef && this.wrapperRef.current) {
            this.wrapperRef.current.focus();
        }
        // Then attempt to move into the object
        if (giveCodeFocus) {
            // This depends upon what type of cell we are.
            if (this.props.cellVM.cell.data.cell_type === 'code') {
                if (this.codeRef.current) {
                    this.codeRef.current.giveFocus(CursorPos.Current);
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
        const allowsPlainInput = getSettings().showCellInputCode || this.props.cellVM.directInput || this.props.cellVM.editable;
        const shouldRender = allowsPlainInput || this.shouldRenderResults();
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';
        const cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        const themeMatplotlibPlots = getSettings().themeMatplotlibPlots ? true : false;

        // Only render if we are allowed to.
        if (shouldRender) {
            return (
                <div className={cellWrapperClass} role={this.props.role} ref={this.wrapperRef} tabIndex={0} onKeyDown={this.onCellKeyDown} onClick={this.onMouseClick} onDoubleClick={this.onMouseDoubleClick}>
                    <div className={cellOuterClass}>
                        {this.renderControls()}
                        <div className='content-div'>
                            <div className='cell-result-container'>
                                {this.renderInput()}
                                <CellOutput
                                    cellVM={this.props.cellVM}
                                    baseTheme={this.props.baseTheme}
                                    expandImage={this.props.expandImage}
                                    openLink={this.props.openLink}
                                    maxTextSize={this.props.maxTextSize}
                                    themeMatplotlibPlots={themeMatplotlibPlots}
                                />
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
        const collapseVisible = (this.props.cellVM.inputBlockCollapseNeeded && this.props.cellVM.inputBlockShow && !this.props.cellVM.editable && this.isCodeCell());
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
                    showLineNumbers={this.props.cellVM.showLineNumbers}
                    font={this.props.font}
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

    private hasOutput = () => {
        return this.getCell().state === CellState.finished || this.getCell().state === CellState.error || this.getCell().state === CellState.executing;
    }

    private getCodeCell = () => {
        return this.props.cellVM.cell.data as nbformat.ICodeCell;
    }

    private shouldRenderResults(): boolean {
        return this.isCodeCell() && this.hasOutput() && this.getCodeCell().outputs && this.getCodeCell().outputs.length > 0 && !this.props.cellVM.hideOutput;
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
