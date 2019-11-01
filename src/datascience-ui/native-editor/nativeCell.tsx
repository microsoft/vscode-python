// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as fastDeepEqual from 'fast-deep-equal';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
import { connect } from 'react-redux';

import { OSType } from '../../client/common/utils/platform';
import { concatMultilineStringInput } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { NativeCommandType } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState } from '../../client/datascience/types';
import { CellInput } from '../interactive-common/cellInput';
import { CellOutput } from '../interactive-common/cellOutput';
import { ExecutionCount } from '../interactive-common/executionCount';
import { InformationMessages } from '../interactive-common/informationMessages';
import { CursorPos, ICellViewModel, IFont } from '../interactive-common/mainState';
import { getOSType } from '../react-common/constants';
import { IKeyboardEvent } from '../react-common/event';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { AddCellLine } from './addCellLine';
import { actionCreators } from './redux/actions';

interface INativeCellBaseProps {
    role?: string;
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    monacoTheme: string | undefined;
    lastCell: boolean;
    firstCell: boolean;
    font: IFont;
    allowUndo: boolean;
    editorOptions: monacoEditor.editor.IEditorOptions;
}

type INativeCellProps = INativeCellBaseProps & typeof actionCreators;

// tslint:disable: react-this-binding-issue
class NativeCell extends React.Component<INativeCellProps> {
    private inputRef: React.RefObject<CellInput> = React.createRef<CellInput>();
    private wrapperRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private lastKeyPressed: string | undefined;

    constructor(prop: INativeCellProps) {
        super(prop);
    }

    public render() {
        if (this.props.cellVM.cell.data.cell_type === 'messages') {
            return <InformationMessages messages={this.props.cellVM.cell.data.messages}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    public componentDidUpdate(prevProps: INativeCellProps) {
        if (this.props.cellVM.selected && !prevProps.cellVM.selected) {
            this.giveFocus(this.props.cellVM.focused, CursorPos.Current);
        }

        // Anytime we update, reset the key. This object will be reused for different cell ids
        this.lastKeyPressed = undefined;
    }

    public shouldComponentUpdate(nextProps: INativeCellProps): boolean {
        return !fastDeepEqual(this.props, nextProps);
    }

    public giveFocus(giveCodeFocus: boolean, cursorPos: CursorPos) {
        // Start out with ourselves
        if (this.wrapperRef && this.wrapperRef.current) {
            this.wrapperRef.current.focus();
        }
        // Then attempt to move into the object
        if (giveCodeFocus) {
            if (this.inputRef && this.inputRef.current) {
                this.inputRef.current.giveFocus(cursorPos);
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

    private isSelected = () => {
        return this.props.cellVM.selected;
    }

    private isFocused = () => {
        return this.props.cellVM.focused;
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
        const content = this.isMarkdownCell() && !this.isShowingMarkdownEditor() ?
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
        if (ev.nativeEvent.target) {
            const elem = ev.nativeEvent.target as HTMLElement;
            if (!elem.className.includes('image-button')) {
                // Not a click on an button in a toolbar, select the cell.
                ev.stopPropagation();
                this.lastKeyPressed = undefined;
                this.props.selectCell(this.cellId);
            }
        }
    }

    private onMouseDoubleClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive double click, propagate upwards. Might change our state
        ev.stopPropagation();
        this.props.focusCell(this.cellId, CursorPos.Current);
    }

    private shouldRenderCodeEditor = () : boolean => {
        return (this.isCodeCell() && (this.props.cellVM.inputBlockShow || this.props.cellVM.editable));
    }

    private shouldRenderMarkdownEditor = () : boolean => {
        return (this.isMarkdownCell() && (this.isShowingMarkdownEditor() || this.props.cellVM.cell.id === Identifiers.EditCellId));
    }

    private isShowingMarkdownEditor = (): boolean => {
        return (this.isMarkdownCell() && this.props.cellVM.focused);
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
            return this.hasOutput() && cell.outputs && !this.props.cellVM.hideOutput && (Array.isArray(cell.outputs) && cell.outputs.length !== 0);
        } else if (this.isMarkdownCell()) {
            return !this.isShowingMarkdownEditor();
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
            case 's':
                if (e.ctrlKey || (e.metaKey && getOSType() === OSType.OSX)) {
                    // This is save, save our cells
                    this.props.save();
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
                    this.props.changeCellType(cellId, this.getCurrentCode());
                    this.props.sendCommand(NativeCommandType.ChangeToCode, 'keyboard');
                }
                break;
            case 'm':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.changeCellType(cellId, this.getCurrentCode());
                    this.props.sendCommand(NativeCommandType.ChangeToMarkdown, 'keyboard');
                }
                break;
            case 'l':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.toggleLineNumbers(cellId);
                    this.props.sendCommand(NativeCommandType.ToggleLineNumbers, 'keyboard');
                }
                break;
            case 'o':
                if (!this.isFocused() && this.isSelected()) {
                    e.stopPropagation();
                    this.props.toggleOutput(cellId);
                    this.props.sendCommand(NativeCommandType.ToggleOutput, 'keyboard');
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
                    this.props.deleteCell(cellId);
                    this.props.sendCommand(NativeCommandType.DeleteCell, 'keyboard');
                }
                break;
            case 'a':
                if (!this.isFocused()) {
                    e.stopPropagation();
                    this.props.insertAbove(cellId);
                    this.props.sendCommand(NativeCommandType.InsertAbove, 'keyboard');
                }
                break;
            case 'b':
                if (!this.isFocused()) {
                    e.stopPropagation();
                    this.props.insertBelow(cellId);
                    this.props.sendCommand(NativeCommandType.InsertBelow, 'keyboard');
                }
                break;
            case 'z':
                if (!this.isFocused() && this.props.allowUndo) {
                    e.stopPropagation();
                    this.props.undo();
                    this.props.sendCommand(NativeCommandType.Undo, 'keyboard');
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

    private escapeCell = (e: IKeyboardEvent) => {
        // Unfocus the current cell by giving focus to the cell itself
        if (this.wrapperRef && this.wrapperRef.current && this.isFocused()) {
            e.stopPropagation();
            this.onCodeUnfocused();
            this.props.sendCommand(NativeCommandType.Unfocus, 'keyboard');
        }
    }

    private arrowUpFromCell = (e: IKeyboardEvent) => {
        e.stopPropagation();
        this.props.arrowUp(this.cellId);
        this.props.sendCommand(NativeCommandType.ArrowUp, 'keyboard');
    }

    private arrowDownFromCell = (e: IKeyboardEvent) => {
        e.stopPropagation();
        this.props.arrowDown(this.cellId);
        this.props.sendCommand(NativeCommandType.ArrowDown, 'keyboard');
    }

    private enterCell = (e: IKeyboardEvent) => {
        // If focused, then ignore this call. It should go to the focused cell instead.
        if (!this.isFocused() && !e.editorInfo && this.wrapperRef && this.wrapperRef && this.isSelected()) {
            e.stopPropagation();
            e.preventDefault();
            this.props.focusCell(this.cellId, CursorPos.Current);
        }
    }

    private shiftEnterCell = (e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit and move to the next.
        this.runAndMove(e.editorInfo ? e.editorInfo.contents : undefined);

        this.props.sendCommand(NativeCommandType.RunAndMove, 'keyboard');
    }

    private altEnterCell = (e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit this cell
        this.runAndAdd(e.editorInfo ? e.editorInfo.contents : undefined);

        this.props.sendCommand(NativeCommandType.RunAndAdd, 'keyboard');
    }

    private runAndMove(possibleContents?: string) {
        // Submit this cell
        this.submitCell(possibleContents);

        // Move to the next cell if we have one
        if (this.props.lastCell) {
            this.props.insertBelow(this.cellId);
        } else {
            this.props.selectNextCell(this.cellId);
        }
    }

    private runAndAdd(possibleContents?: string) {
        // Submit this cell
        this.submitCell(possibleContents);

        // insert a cell below this one
        this.props.insertBelow(this.cellId);
    }

    private ctrlEnterCell = (e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit this cell
        this.submitCell(e.editorInfo ? e.editorInfo.contents : undefined);
        this.props.sendCommand(NativeCommandType.Run, 'keyboard');
    }

    private submitCell = (possibleContents?: string) => {
        let content: string | undefined ;

        // If inside editor, submit this code
        if (possibleContents) {
            content = possibleContents;
        } else {
            // Outside editor, just use the cell
            content = concatMultilineStringInput(this.props.cellVM.cell.data.source);
        }

        // Send to jupyter
        if (content) {
            this.props.executeCell(this.cellId, content);
        }
    }

    private addNewCell = () => {
        this.props.insertBelow(this.cellId);
        this.props.sendCommand(NativeCommandType.AddToEnd, 'mouse');
    }

    private renderNavbar = () => {
        const moveUp = () => {
            this.props.moveCellUp(this.cellId);
            this.props.sendCommand(NativeCommandType.MoveCellUp, 'mouse');
        };
        const moveDown = () => {
            this.props.moveCellUp(this.cellId);
            this.props.sendCommand(NativeCommandType.MoveCellDown, 'mouse');
        };
        const addButtonRender = !this.props.lastCell ?
            <div className='navbar-add-button'>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.addNewCell} tooltip={getLocString('DataScience.insertBelow', 'Insert cell below')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                </ImageButton>
            </div> : null;

        return (
            <div className='navbar-div'>
                <div>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={moveUp} disabled={this.props.firstCell} tooltip={getLocString('DataScience.moveCellUp', 'Move cell up')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Up} />
                    </ImageButton>
                </div>
                <div>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={moveDown} disabled={this.props.lastCell} tooltip={getLocString('DataScience.moveCellDown', 'Move cell down')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Down} />
                    </ImageButton>
                </div>
                {addButtonRender}
            </div>
        );
    }

    private renderAddDivider = (checkOutput: boolean) => {
        // Skip on the last cell
        if (!this.props.lastCell) {
            // Divider should only show if no output
            if (!checkOutput || !this.shouldRenderOutput()) {
                return (
                    <AddCellLine className='add-divider' baseTheme={this.props.baseTheme} includePlus={false} click={this.addNewCell} />
                );
            }
        }

        return null;
    }

    private getCurrentCode(): string {
        const contents = this.inputRef.current ? this.inputRef.current.getContents() : undefined;
        return contents || '';
    }

    private renderMiddleToolbar = () => {
        const cellId = this.props.cellVM.cell.id;
        const deleteCell = () => {
            this.props.deleteCell(cellId);
            this.props.sendCommand(NativeCommandType.DeleteCell, 'mouse');
        };
        const runAbove = () => {
            this.props.executeAbove(cellId);
            this.props.sendCommand(NativeCommandType.RunAbove, 'mouse');
        };
        const runBelow = () => {
            if (this.inputRef.current) {
                this.props.executeCellAndBelow(cellId, this.getCurrentCode());
                this.props.sendCommand(NativeCommandType.RunBelow, 'mouse');
            }
        };
        const canRunAbove = !this.props.firstCell;
        const canRunBelow = this.props.cellVM.cell.state === CellState.finished || this.props.cellVM.cell.state === CellState.error;
        const switchTooltip = this.props.cellVM.cell.data.cell_type === 'code' ? getLocString('DataScience.switchToMarkdown', 'Change to markdown') :
            getLocString('DataScience.switchToCode', 'Change to code');
        const otherCellType = this.props.cellVM.cell.data.cell_type === 'code' ? 'markdown' : 'code';
        const otherCellTypeCommand = otherCellType === 'markdown' ? NativeCommandType.ChangeToMarkdown : NativeCommandType.ChangeToCode;
        const otherCellImage = otherCellType === 'markdown' ? ImageName.SwitchToMarkdown : ImageName.SwitchToCode;
        const switchCellType = () => {
            this.props.changeCellType(cellId, this.getCurrentCode());
            this.props.sendCommand(otherCellTypeCommand, 'mouse');
        };

        return (
            <div className='native-editor-celltoolbar-middle'>
                <ImageButton baseTheme={this.props.baseTheme} onClick={runAbove} disabled={!canRunAbove} tooltip={getLocString('DataScience.runAbove', 'Run cells above')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAbove} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={runBelow} disabled={!canRunBelow} tooltip={getLocString('DataScience.runBelow', 'Run cell and below')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunBelow} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onMouseDown={switchCellType} tooltip={switchTooltip}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={otherCellImage} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={deleteCell} tooltip={getLocString('DataScience.deleteCell', 'Delete cell')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Delete} />
                </ImageButton>
            </div>
        );
    }

    private renderControls = () => {
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '-';
        const runCell = () => {
            this.runAndMove(this.inputRef.current ? this.inputRef.current.getContents() : undefined);
            this.props.sendCommand(NativeCommandType.Run, 'mouse');
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
                    editorOptions={this.props.editorOptions}
                    history={undefined}
                    autoFocus={this.props.autoFocus}
                    codeTheme={this.props.codeTheme}
                    onCodeChange={this.onCodeChange}
                    onCodeCreated={this.onCodeCreated}
                    testMode={this.props.testMode ? true : false}
                    showWatermark={false}
                    ref={this.inputRef}
                    monacoTheme={this.props.monacoTheme}
                    openLink={this.props.openLink}
                    editorMeasureClassName={undefined}
                    focused={this.onCodeFocused}
                    unfocused={this.onCodeUnfocused}
                    keyDown={this.keyDownInput}
                    showLineNumbers={this.props.cellVM.showLineNumbers}
                    font={this.props.font}
                />
            );
        }
        return null;
    }

    private onCodeFocused = () => {
        this.props.focusCell(this.cellId, CursorPos.Current);
    }

    private onCodeUnfocused = () => {
        // Make sure to save the code from the editor into the cell
        const contents = this.inputRef.current ? this.inputRef.current.getContents() : concatMultilineStringInput(this.props.cellVM.cell.data.source);
        this.props.unfocusCell(this.cellId, contents!);
    }

    private onCodeChange = (changes: monacoEditor.editor.IModelContentChange[], cellId: string, _modelId: string) => {
        this.props.editCell(cellId, changes);
    }

    private onCodeCreated = (_code: string, _file: string, _cellId: string, _modelId: string) => {
        // Used to use this to track the model id. Might still need it for intellisense.
    }


    private renderOutput = (): JSX.Element | null => {
        const themeMatplotlibPlots = getSettings().themeMatplotlibPlots ? true : false;
        if (this.shouldRenderOutput()) {
            return (
                <CellOutput
                    cellVM={this.props.cellVM}
                    baseTheme={this.props.baseTheme}
                    expandImage={this.props.showPlot}
                    openLink={this.props.openLink}
                    maxTextSize={this.props.maxTextSize}
                    themeMatplotlibPlots={themeMatplotlibPlots}
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

        if (this.isSelected() && !this.isFocused()) {
            classes += ' collapse-bar-selected';
        }
        if (this.isFocused()) {
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

// Main export, return a redux connected editor
export function getConnectedNativeCell() {
    return connect(
        null,
        actionCreators,
        null,
        { withRef: true }
    )(NativeCell);
}
