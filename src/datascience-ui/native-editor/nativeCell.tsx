// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as React from 'react';

import { concatMultilineString } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { NativeCommandType } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState, ICell } from '../../client/datascience/types';
import { CellInput } from '../interactive-common/cellInput';
import { CellOutput } from '../interactive-common/cellOutput';
import { ExecutionCount } from '../interactive-common/executionCount';
import { InformationMessages } from '../interactive-common/informationMessages';
import { ICellViewModel } from '../interactive-common/mainState';
import { IKeyboardEvent } from '../react-common/event';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { AddCellLine } from './addCellLine';
import { NativeEditorStateController } from './nativeEditorStateController';

interface INativeCellProps {
    role?: string;
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    stateController: NativeEditorStateController;
    monacoTheme: string | undefined;
    hideOutput?: boolean;
    showLineNumbers?: boolean;
    selectedCell?: string;
    focusedCell?: string;
    focusCell(cellId: string, focusCode: boolean): void;
    selectCell(cellId: string): void;
}

interface INativeCellState {
    showingMarkdownEditor: boolean;
}
// tslint:disable: react-this-binding-issue
export class NativeCell extends React.Component<INativeCellProps, INativeCellState> {
    private inputRef: React.RefObject<CellInput> = React.createRef<CellInput>();
    private wrapperRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private lastKeyPressed: string | undefined;
    private pendingFocusLoss?: () => void;

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

        // Anytime we update, reset the key. This object will be reused for different cell ids
        this.lastKeyPressed = undefined;
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

    public moveCellUp = () => {
        if (this.wrapperRef.current) {
            const wasFocused = this.isFocused();
            const cellId = this.cellId;
            this.props.stateController.moveCellUp(cellId);
            setTimeout(() => this.props.focusCell(cellId, wasFocused ? true : false), 1);
        }
    }

    public moveCellDown = () => {
        if (this.wrapperRef.current) {
            const wasFocused = this.isFocused();
            const cellId = this.cellId;
            this.props.stateController.moveCellDown(cellId);
            setTimeout(() => this.props.focusCell(cellId, wasFocused ? true : false), 1);
        }
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

    private isLastCell = () => {
        const cellVMs = this.props.stateController.getState().cellVMs;
        const index = cellVMs.indexOf(this.props.cellVM);
        return index === cellVMs.length - 1;
    }

    private isSelected = () => {
        return this.props.selectedCell === this.cellId;
    }

    private isFocused = () => {
        return this.props.focusedCell === this.cellId;
    }

    private renderNormalCell() {
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';
        let cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        if (this.isSelected() && !this.isFocused()) {
            cellWrapperClass += ' cell-wrapper-selected';
        }
        if (this.isFocused()) {
            cellWrapperClass += ' cell-wrapper-focused';
        }

        // Content changes based on if a markdown cell or not.
        const content = this.isMarkdownCell() && !this.state.showingMarkdownEditor ?
            <div className='cell-result-container'>
                <div className='cell-row-container'>
                    {this.renderCollapseBar(false)}
                    {this.renderOutput()}
                    {this.renderMiddleToolbar()}
                </div>
                {this.renderAddDivider(false)}
            </div> :
            <div className='cell-result-container'>
                <div className='cell-row-container'>
                    {this.renderCollapseBar(true)}
                    {this.renderControls()}
                    {this.renderInput()}
                    {this.renderMiddleToolbar()}
                </div>
                {this.renderAddDivider(true)}
                <div className='cell-row-container'>
                    {this.renderCollapseBar(false)}
                    {this.renderOutput()}
                </div>
            </div>;

        return (
            <div className={cellWrapperClass} role={this.props.role} ref={this.wrapperRef} tabIndex={0} onKeyDown={this.onOuterKeyDown} onClick={this.onMouseClick} onDoubleClick={this.onMouseDoubleClick}>
                <div className={cellOuterClass}>
                    {this.renderNavbar()}
                    <div className='content-div'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    private onMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive a click, propagate upwards. Might change our state
        ev.stopPropagation();
        this.lastKeyPressed = undefined;
        const focusedCell = this.isFocused() ? this.cellId : undefined;
        this.props.stateController.selectCell(this.cellId, focusedCell);
    }

    private onMouseDoubleClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive double click, propagate upwards. Might change our state
        ev.stopPropagation();
        this.props.focusCell(this.cellId, true);
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
            const cell = this.getCodeCell();
            return this.hasOutput() && cell.outputs && !this.props.hideOutput && (Array.isArray(cell.outputs) && cell.outputs.length !== 0);
        } else if (this.isMarkdownCell()) {
            return !this.state.showingMarkdownEditor;
        }
        return false;
    }

    // tslint:disable-next-line: cyclomatic-complexity max-func-body-length
    private keyDownInput = (cellId: string, e: IKeyboardEvent) => {
        const isFocusedWhenNotSuggesting = this.isFocused() && e.editorInfo && !e.editorInfo.isSuggesting;
        switch (e.code) {
            case 'ArrowUp':
            case 'k':
                if ((isFocusedWhenNotSuggesting && e.editorInfo!.isFirstLine) || !this.isFocused()) {
                    this.arrowUpFromCell(e);
                }
                break;
            case 'ArrowDown':
            case 'j':
                if ((isFocusedWhenNotSuggesting && e.editorInfo!.isLastLine) || !this.isFocused()) {
                    this.arrowDownFromCell(e);
                }
                break;
            case 'Escape':
                if (isFocusedWhenNotSuggesting) {
                    this.escapeCell(e);
                }
                break;
            case 'y':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.stateController.changeCellType(cellId, 'code');
                    this.props.stateController.sendCommand(NativeCommandType.ChangeToCode, 'keyboard');
                }
                break;
            case 'm':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.stateController.changeCellType(cellId, 'markdown');
                    this.props.stateController.sendCommand(NativeCommandType.ChangeToMarkdown, 'keyboard');
                }
                break;
            case 'l':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.stateController.toggleLineNumbers(cellId);
                    this.props.stateController.sendCommand(NativeCommandType.ToggleLineNumbers, 'keyboard');
                }
                break;
            case 'o':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.stateController.toggleOutput(cellId);
                    this.props.stateController.sendCommand(NativeCommandType.ToggleOutput, 'keyboard');
                }
                break;
            case 'Enter':
                if (e.shiftKey) {
                    this.shiftEnterCell(e);
                } else if (e.ctrlKey) {
                    this.ctrlEnterCell(e);
                } else if (e.altKey) {
                    this.altEnterCell(e);
                } else {
                    this.enterCell(e);
                }
                break;
            case 'd':
                if (this.lastKeyPressed === 'd' && !this.isFocused()  && this.isSelected()) {
                    e.stopPropagation();
                    this.lastKeyPressed = undefined; // Reset it so we don't keep deleting
                    const cellToSelect = this.getPrevCellId() || this.getNextCellId();
                    this.props.stateController.possiblyDeleteCell(cellId);
                    this.props.stateController.sendCommand(NativeCommandType.DeleteCell, 'keyboard');
                    if (cellToSelect) {
                        this.moveSelection(cellToSelect);
                    }
                }
                break;
            case 'a':
                if (isFocusedWhenNotSuggesting || !this.isFocused()) {
                    e.stopPropagation();
                    const cell = this.props.stateController.insertAbove(cellId, true);
                    this.moveSelection(cell!);
                    this.props.stateController.sendCommand(NativeCommandType.InsertAbove, 'keyboard');
                }
                break;
            case 'b':
                if (isFocusedWhenNotSuggesting || !this.isFocused()) {
                    e.stopPropagation();
                    const cell = this.props.stateController.insertBelow(cellId, true);
                    this.moveSelection(cell!);
                    this.props.stateController.sendCommand(NativeCommandType.InsertBelow, 'keyboard');
                }
                break;
            case 'z':
                if (!this.isFocused() && this.props.stateController.canUndo()) {
                    e.stopPropagation();
                    this.props.stateController.undo();
                    this.props.stateController.sendCommand(NativeCommandType.Undo, 'keyboard');
                }
                break;

            default:
                break;
        }

        this.lastKeyPressed = e.code;
    }

    private get cellId(): string {
        return this.props.cellVM.cell.id;
    }

    private getNonMessageCells(): ICell[] {
        return this.props.stateController.getState().cellVMs.map(cvm => cvm.cell).filter(c => c.data.cell_type !== 'messages');
    }

    private getPrevCellId(): string | undefined {
        const cells = this.getNonMessageCells();
        const index = cells.findIndex(c => c.id === this.cellId);
        if (index > 0) {
            return cells[index - 1].id;
        }
        return undefined;
    }

    private getNextCellId(): string | undefined {
        const cells = this.getNonMessageCells();

        // Find the next cell to move to
        const index = cells.findIndex(c => c.id === this.cellId);
        let nextCellId: string | undefined;
        if (index >= 0) {
            if (index < cells.length - 1) {
                nextCellId = cells[index + 1].id;
            }
        }

        return nextCellId;
    }

    private escapeCell = (e: IKeyboardEvent) => {
        // Unfocus the current cell by giving focus to the cell itself
        if (this.wrapperRef && this.wrapperRef.current && this.isFocused()) {
            e.stopPropagation();
            this.props.focusCell(this.cellId, false);
            this.props.stateController.sendCommand(NativeCommandType.Unfocus, 'keyboard');
        }
    }

    private arrowUpFromCell = (e: IKeyboardEvent) => {
        const prevCellId = this.getPrevCellId();
        if (prevCellId) {
            e.stopPropagation();
            this.moveSelection(prevCellId);
        }

        this.props.stateController.sendCommand(NativeCommandType.ArrowUp, 'keyboard');
    }

    private arrowDownFromCell = (e: IKeyboardEvent) => {
        const nextCellId = this.getNextCellId();

        if (nextCellId) {
            e.stopPropagation();
            this.moveSelection(nextCellId);
        }

        this.props.stateController.sendCommand(NativeCommandType.ArrowDown, 'keyboard');
    }

    private enterCell = (e: IKeyboardEvent) => {
        // If focused, then ignore this call. It should go to the focused cell instead.
        if (!this.isFocused() && !e.editorInfo && this.wrapperRef && this.wrapperRef && this.isSelected()) {
            e.stopPropagation();
            e.preventDefault();
            this.props.focusCell(this.cellId, true);
        }
    }

    private shiftEnterCell = (e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit and move to the next.
        this.runAndMove(e.editorInfo ? e.editorInfo.contents : undefined);

        this.props.stateController.sendCommand(NativeCommandType.RunAndMove, 'keyboard');
    }

    private altEnterCell = (e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit this cell
        this.runAndAdd(e.editorInfo ? e.editorInfo.contents : undefined);

        this.props.stateController.sendCommand(NativeCommandType.RunAndAdd, 'keyboard');
    }

    private runAndMove(possibleContents?: string) {
        // Submit this cell
        this.submitCell(possibleContents);

        // Move to the next cell if we have one and give it focus
        let nextCell = this.getNextCellId();
        if (!nextCell) {
            // At the bottom insert a cell to move to instead
            nextCell = this.props.stateController.insertBelow(this.cellId, true);
        }
        if (nextCell) {
            this.moveSelection(nextCell);
        }
    }

    private runAndAdd(possibleContents?: string) {
        // Submit this cell
        this.submitCell(possibleContents);

        // insert a cell below this one
        const nextCell = this.props.stateController.insertBelow(this.cellId, true);

        // On next update, move the new cell
        if (nextCell) {
            this.moveSelection(nextCell);
        }
    }

    private ctrlEnterCell = (e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit this cell
        this.submitCell(e.editorInfo ? e.editorInfo.contents : undefined);
        this.props.stateController.sendCommand(NativeCommandType.Run, 'keyboard');
    }

    private moveSelection = (cellId: string) => {
        this.props.selectCell(cellId);
    }

    private submitCell = (possibleContents?: string) => {
        let content: string | undefined ;

        // If inside editor, submit this code
        if (possibleContents) {
            content = possibleContents;
        } else {
            // Outside editor, just use the cell
            content = concatMultilineString(this.props.cellVM.cell.data.source);
        }

        // Send to jupyter
        if (content) {
            this.props.stateController.submitInput(content, this.props.cellVM);
        }
    }

    private addNewCell = () => {
        const newCell = this.props.stateController.insertBelow(this.props.cellVM.cell.id, true);
        this.props.stateController.sendCommand(NativeCommandType.AddToEnd, 'mouse');
        if (newCell) {
            this.props.selectCell(newCell);
        }
    }

    private renderNavbar = () => {
        const cellId = this.props.cellVM.cell.id;

        const moveUp = () => {
            this.moveCellUp();
            this.props.stateController.sendCommand(NativeCommandType.MoveCellUp, 'mouse');
        };
        const moveDown = () => {
            this.moveCellDown();
            this.props.stateController.sendCommand(NativeCommandType.MoveCellDown, 'mouse');
        };
        const canMoveUp = this.props.stateController.canMoveUp(cellId);
        const canMoveDown = this.props.stateController.canMoveDown(cellId);
        const addButtonRender = this.getNextCellId() !== undefined ?
            <div className='navbar-add-button'>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.addNewCell} tooltip={getLocString('DataScience.insertBelow', 'Insert cell below')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                </ImageButton>
            </div> : null;

        return (
            <div className='navbar-div'>
                <div>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={moveUp} disabled={!canMoveUp} tooltip={getLocString('DataScience.moveCellUp', 'Move cell up')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Up} />
                    </ImageButton>
                </div>
                <div>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={moveDown} disabled={!canMoveDown} tooltip={getLocString('DataScience.moveCellDown', 'Move cell down')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Down} />
                    </ImageButton>
                </div>
                {addButtonRender}
            </div>
        );
    }

    private renderAddDivider = (checkOutput: boolean) => {
        // Skip on the last cell
        if (!this.isLastCell()) {
            // Divider should only show if no output
            if (!checkOutput || !this.shouldRenderOutput()) {
                return (
                    <AddCellLine className='add-divider' baseTheme={this.props.baseTheme} includePlus={false} click={this.addNewCell} />
                );
            }
        }

        return null;
    }

    private renderMiddleToolbar = () => {
        const cellId = this.props.cellVM.cell.id;
        const deleteCell = () => {
            const cellToSelect = this.getNextCellId() || this.getPrevCellId();
            this.props.stateController.possiblyDeleteCell(cellId);
            this.props.stateController.sendCommand(NativeCommandType.DeleteCell, 'mouse');
            setTimeout(() => {
                if (cellToSelect) {
                    this.moveSelection(cellToSelect);
                }
            }, 10);
        };
        const runAbove = () => {
            this.props.stateController.runAbove(cellId);
            this.props.stateController.sendCommand(NativeCommandType.RunAbove, 'mouse');
        };
        const runBelow = () => {
            this.props.stateController.runBelow(cellId);
            this.props.stateController.sendCommand(NativeCommandType.RunBelow, 'mouse');
        };
        const canRunAbove = this.props.stateController.canRunAbove(cellId);
        const canRunBelow = this.props.cellVM.cell.state === CellState.finished || this.props.cellVM.cell.state === CellState.error;
        const switchTooltip = this.props.cellVM.cell.data.cell_type === 'code' ? getLocString('DataScience.switchToMarkdown', 'Change to markdown') :
            getLocString('DataScience.switchToCode', 'Change to code');
        const switchToMarkdown = () => {
            this.props.stateController.changeCellType(cellId, 'markdown');
            this.props.stateController.sendCommand(NativeCommandType.ChangeToMarkdown, 'mouse');
            setTimeout(() => this.props.focusCell(cellId, true), 10);
        };
        const switchToCode = () => {
            const handler = () => {
                setTimeout(() => {
                    this.props.stateController.changeCellType(cellId, 'code');
                    this.props.stateController.sendCommand(NativeCommandType.ChangeToCode, 'mouse');
                    this.props.focusCell(cellId, true);
                }, 10);
            };

            // This is special. Coming in on a mouse down event so we get
            // called before focus changes. After focus changes, then switch to code
            if (this.state.showingMarkdownEditor) {
                this.pendingFocusLoss = handler;
            } else {
                handler();
            }
        };
        const switchButton = this.props.cellVM.cell.data.cell_type === 'code' ?
            <ImageButton baseTheme={this.props.baseTheme} onClick={switchToMarkdown} tooltip={switchTooltip}>
                <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SwitchToMarkdown} />
            </ImageButton> :
            <ImageButton baseTheme={this.props.baseTheme} onMouseDown={switchToCode} tooltip={switchTooltip}>
                <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SwitchToCode} />
            </ImageButton>;

        return (
            <div className='native-editor-celltoolbar-middle'>
                <ImageButton baseTheme={this.props.baseTheme} onClick={runAbove} disabled={!canRunAbove} tooltip={getLocString('DataScience.runAbove', 'Run cells above')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAbove} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={runBelow} disabled={!canRunBelow} tooltip={getLocString('DataScience.runBelow', 'Run cell and below')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunBelow} />
                </ImageButton>
                {switchButton}
                <ImageButton baseTheme={this.props.baseTheme} onClick={deleteCell} tooltip={getLocString('DataScience.deleteCell', 'Delete cell')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Delete} />
                </ImageButton>
            </div>
        );
    }

    private renderControls = () => {
        const cellId = this.props.cellVM.cell.id;
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '-';
        const runCell = () => {
            this.props.stateController.updateCellSource(cellId);
            this.props.stateController.submitInput(concatMultilineString(this.props.cellVM.cell.data.source), this.props.cellVM);
            this.props.focusCell(cellId, false);
            this.props.stateController.sendCommand(NativeCommandType.Run, 'mouse');
        };
        const canRunBelow = this.props.cellVM.cell.state === CellState.finished || this.props.cellVM.cell.state === CellState.error;
        const runCellHidden = !canRunBelow || this.isMarkdownCell();

        return (
            <div className='controls-div'>
                <ExecutionCount isBusy={busy} count={executionCount} visible={this.isCodeCell()} />
                <div className='native-editor-celltoolbar-inner'>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runCell} hidden={runCellHidden} tooltip={getLocString('DataScience.runCell', 'Run cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Run} />
                    </ImageButton>
                </div>
            </div>
        );
    }

    private renderInput = () => {
        if (this.shouldRenderInput()) {
            return (
                <CellInput
                    cellVM={this.props.cellVM}
                    editorOptions={this.props.stateController.getState().editorOptions}
                    history={undefined}
                    autoFocus={this.props.autoFocus}
                    codeTheme={this.props.codeTheme}
                    onCodeChange={this.props.stateController.codeChange}
                    onCodeCreated={this.props.stateController.editableCodeCreated}
                    testMode={this.props.testMode ? true : false}
                    showWatermark={false}
                    ref={this.inputRef}
                    monacoTheme={this.props.monacoTheme}
                    openLink={this.props.stateController.openLink}
                    editorMeasureClassName={undefined}
                    focused={this.isCodeCell() ? this.onCodeFocused : this.onMarkdownFocused}
                    unfocused={this.isCodeCell() ? this.onCodeUnfocused : this.onMarkdownUnfocused}
                    keyDown={this.keyDownInput}
                    showLineNumbers={this.props.showLineNumbers}
                />
            );
        }
        return null;
    }

    private onCodeFocused = () => {
        this.props.stateController.codeGotFocus(this.cellId);
    }

    private onCodeUnfocused = () => {
        this.props.stateController.codeLostFocus(this.cellId);
    }

    private onMarkdownFocused = () => {
        this.props.stateController.codeGotFocus(this.cellId);
    }

    private onMarkdownUnfocused = () => {
        this.props.stateController.codeLostFocus(this.cellId);

        // There might be a pending focus loss handler.
        if (this.pendingFocusLoss) {
            const func = this.pendingFocusLoss;
            this.pendingFocusLoss = undefined;
            func();
        }

        // Indicate not showing the editor anymore. The equivalent of this
        // is not when we receive focus but when we GIVE focus to the markdown editor
        // otherwise we wouldn't be able to display it.
        this.setState({showingMarkdownEditor: false});
    }

    private renderOutput = (): JSX.Element | null => {
        if (this.shouldRenderOutput()) {
            return (
                <CellOutput
                    cellVM={this.props.cellVM}
                    baseTheme={this.props.baseTheme}
                    expandImage={this.props.stateController.showPlot}
                    openLink={this.props.stateController.openLink}
                 />
            );
        }
        return null;
    }

    private onOuterKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Handle keydown events for the entire cell
        if (event.key !== 'Tab') {
            this.keyDownInput(
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

    private renderCollapseBar = (input: boolean) => {
        let classes = 'collapse-bar';

        if (this.props.selectedCell === this.props.cellVM.cell.id && this.props.focusedCell !== this.props.cellVM.cell.id) {
            classes += ' collapse-bar-selected';
        }
        if (this.props.focusedCell === this.props.cellVM.cell.id) {
            classes += ' collapse-bar-focused';
        }

        if (input) {
            return <div className={classes}></div>;
        }

        if (this.props.cellVM.cell.data.cell_type === 'markdown') {
            classes += ' collapse-bar-markdown';
        } else if (Array.isArray(this.props.cellVM.cell.data.outputs) && this.props.cellVM.cell.data.outputs.length !== 0) {
            classes += ' collapse-bar-output';
        } else {
            return null;
        }

        return <div className={classes}></div>;
    }
}
