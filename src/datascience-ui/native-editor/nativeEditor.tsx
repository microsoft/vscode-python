// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './nativeEditor.less';

import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { concatMultilineString } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { NativeCommandType } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState, ICell } from '../../client/datascience/types';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { ICellViewModel, IMainState } from '../interactive-common/mainState';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { Button } from '../react-common/button';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { IKeyboardEvent } from '../react-common/event';
import { Flyout } from '../react-common/flyout';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { getSettings } from '../react-common/settingsReactSide';
import { NativeCell } from './nativeCell';
import { NativeEditorStateController } from './nativeEditorStateController';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');
// tslint:disable-next-line: no-require-imports
import cloneDeep = require('lodash/cloneDeep');

interface INativeEditorProps {
    skipDefault: boolean;
    testMode?: boolean;
    codeTheme: string;
    baseTheme: string;
}

export class NativeEditor extends React.Component<INativeEditorProps, IMainState> {
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private contentPanelScrollRef: React.RefObject<HTMLElement> = React.createRef<HTMLElement>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private stateController: NativeEditorStateController;
    private debounceUpdateVisibleCells = debounce(this.updateVisibleCells.bind(this), 100);
    private lastKeyPressed: string | undefined;
    private cellRefs: Map<string, React.RefObject<NativeCell>> = new Map<string, React.RefObject<NativeCell>>();
    private cellContainerRefs: Map<string, React.RefObject<HTMLDivElement>> = new Map<string, React.RefObject<HTMLDivElement>>();
    private initialVisibilityUpdate: boolean = false;

    constructor(props: INativeEditorProps) {
        super(props);

        // Create our state controller. It manages updating our state.
        this.stateController = new NativeEditorStateController({
            skipDefault: this.props.skipDefault,
            testMode: this.props.testMode ? true : false,
            expectingDark: this.props.baseTheme !== 'vscode-light',
            setState: this.setState.bind(this),
            activate: this.activated.bind(this),
            scrollToCell: this.scrollToCell.bind(this),
            defaultEditable: true,
            hasEdit: false,
            enableGather: false
        });

        // Default our state.
        this.state = this.stateController.getState();
    }

    public shouldComponentUpdate(_nextProps: INativeEditorProps, nextState: IMainState): boolean {
        return this.stateController.requiresUpdate(this.state, nextState);
    }

    public componentDidMount() {
        window.addEventListener('keydown', this.mainKeyDown);
        window.addEventListener('resize', () => this.forceUpdate(), true);
    }

    public componentWillUnmount() {
        window.removeEventListener('keydown', this.mainKeyDown);
        window.removeEventListener('resize', () => this.forceUpdate());
        // Dispose of our state controller so it stops listening
        this.stateController.dispose();
    }

    public render() {
        // Update the state controller with our new state
        this.stateController.renderUpdate(this.state);

        return (
            <div id='main-panel' ref={this.mainPanelRef} role='Main'>
                <div className='styleSetter'>
                    <style>
                        {this.state.rootCss}
                    </style>
                </div>
                <header id='main-panel-toolbar'>
                    {this.renderToolbarPanel()}
                </header>
                <section id='main-panel-variable' aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}>
                    {this.renderVariablePanel(this.props.baseTheme)}
                </section>
                <main id='main-panel-content' onScroll={this.onContentScroll} ref={this.contentPanelScrollRef}>
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
            </div>
        );
    }

    private activated = () => {
        // Make sure the input cell gets focus
        if (getSettings && getSettings().allowInput) {
            // Delay this so that we make sure the outer frame has focus first.
            setTimeout(() => {
                // First we have to give ourselves focus (so that focus actually ends up in the code cell)
                if (this.mainPanelRef && this.mainPanelRef.current) {
                    this.mainPanelRef.current.focus({preventScroll: true});
                }
            }, 100);
        }
    }

    private scrollToCell(_id: string) {
        // Not used in the native editor
        noop();
    }

    // tslint:disable: react-this-binding-issue
    private renderToolbarPanel() {
        const addCell = () => {
            this.stateController.addNewCell();
            this.stateController.sendCommand(NativeCommandType.AddToEnd, 'mouse');
        };
        const runAll = () => {
            this.stateController.runAll();
            this.stateController.sendCommand(NativeCommandType.RunAll, 'mouse');
        };

        return (
            <div id='toolbar-panel'>
                <div className='toolbar-menu-bar'>
                <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.restartKernel} className='native-button' tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Restart} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.interruptKernel} className='native-button' tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Interrupt} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={addCell} className='native-button' tooltip={getLocString('DataScience.addNewCell', 'Insert cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runAll} className='native-button' tooltip={getLocString('DataScience.runAll', 'Run All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAll} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.save} disabled={!this.state.dirty} className='native-button' tooltip={getLocString('DataScience.save', 'Save File')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs} />
                    </ImageButton>
                    <Button onClick={this.stateController.export} disabled={!this.stateController.canExport()} className='save-button' tooltip={getLocString('DataScience.exportAsPythonFileTooltip', 'Save As Python File')}>
                        <span>{getLocString('DataScience.exportAsPythonFileTitle', 'Save As Python File')}</span>
                    </Button>
                </div>
                <div className='toolbar-divider'/>
            </div>
        );
    }

    private renderVariablePanel(baseTheme: string) {
        const variableProps = this.getVariableProps(baseTheme);
        return <VariablePanel {...variableProps} />;
    }

    private renderContentPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.state.tokenizerLoaded && !this.props.testMode) {
            return null;
        }

        // Otherwise render our cells.
        const contentProps = this.getContentProps(baseTheme);
        return <ContentPanel {...contentProps} ref={this.contentPanelRef}/>;
    }

    private getContentProps = (baseTheme: string): IContentPanelProps => {
        return {
            baseTheme: baseTheme,
            cellVMs: this.state.cellVMs,
            history: this.state.history,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.state.submittedText,
            skipNextScroll: this.state.skipNextScroll ? true : false,
            editable: true,
            renderCell: this.renderCell,
            scrollToBottom: this.scrollDiv
        };
    }
    private getVariableProps = (baseTheme: string): IVariablePanelProps => {
       return {
        variables: this.state.variables,
        pendingVariableCount: this.state.pendingVariableCount,
        debugging: this.state.debugging,
        busy: this.state.busy,
        showDataExplorer: this.stateController.showDataViewer,
        skipDefault: this.props.skipDefault,
        testMode: this.props.testMode,
        refreshVariables: this.stateController.refreshVariables,
        variableExplorerToggled: this.stateController.variableExplorerToggled,
        baseTheme: baseTheme
       };
    }

    private getNonMessageCells(): ICell[] {
        return this.state.cellVMs.map(cvm => cvm.cell).filter(c => c.data.cell_type !== 'messages');
    }

    private onContentScroll = (_event: React.UIEvent<HTMLDivElement>) => {
        if (this.contentPanelScrollRef.current) {
            this.debounceUpdateVisibleCells();
        }
    }

    private updateVisibleCells()  {
        if (this.contentPanelScrollRef.current && this.cellContainerRefs.size !== 0) {
            const visibleTop = this.contentPanelScrollRef.current.offsetTop + this.contentPanelScrollRef.current.scrollTop;
            const visibleBottom = visibleTop + this.contentPanelScrollRef.current.clientHeight;
            const cellVMs = [...this.state.cellVMs];

            // Go through the cell divs and find the ones that are suddenly visible
            let makeChange = false;
            for (let i = 0; i < cellVMs.length; i += 1) {
                const cellVM = cellVMs[i];
                if (cellVM.useQuickEdit && this.cellRefs.has(cellVM.cell.id)) {
                    const ref = this.cellContainerRefs.get(cellVM.cell.id);
                    if (ref && ref.current) {
                        const top = ref.current.offsetTop;
                        const bottom = top + ref.current.offsetHeight;
                        if (top > visibleBottom) {
                            break;
                        } else if (bottom < visibleTop) {
                            continue;
                        } else {
                            cellVMs[i] = cloneDeep(cellVM);
                            cellVMs[i].useQuickEdit = false;
                            makeChange = true;
                        }
                    }
                }
            }

            // update our state so that newly visible items appear
            if (makeChange) {
                this.setState({cellVMs});
            }
        }
    }

    private findCellViewModel(cellId: string): ICellViewModel | undefined {
        let result = this.state.cellVMs.find(c => c.cell.id === cellId);
        if (!result) {
            result = cellId === Identifiers.EditCellId ? this.state.editCellVM : undefined;
        }
        return result;
    }

    private mainKeyDown = (event: KeyboardEvent) => {
        // Handler for key down presses in the main panel
        switch (event.key) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: How to have this work for when the keyboard shortcuts are changed?
            case 's':
                if (event.ctrlKey) {
                    // This is save, save our cells
                    this.stateController.save();
                }
                break;

            default:
                break;
        }
    }

    // tslint:disable-next-line: cyclomatic-complexity max-func-body-length
    private keyDownCell = async (cellId: string, e: IKeyboardEvent) => {
        const isFocusedWhenNotSuggesting = this.state.focusedCell && e.editorInfo && !e.editorInfo.isSuggesting;
        switch (e.code) {
            case 'ArrowUp':
            case 'k':
                if ((isFocusedWhenNotSuggesting && e.editorInfo!.isFirstLine) || !this.state.focusedCell) {
                    this.arrowUpFromCell(cellId, e);
                }
                break;
            case 'ArrowDown':
            case 'j':
                if ((isFocusedWhenNotSuggesting && e.editorInfo!.isLastLine) || !this.state.focusedCell) {
                    this.arrowDownFromCell(cellId, e);
                }
                break;
            case 'Escape':
                if (isFocusedWhenNotSuggesting) {
                    this.escapeCell(this.state.focusedCell!, e);
                }
                break;
            case 'y':
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.changeCellType(this.state.selectedCell, 'code');
                    this.stateController.sendCommand(NativeCommandType.ChangeToCode, 'keyboard');
                }
                break;
            case 'm':
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.changeCellType(this.state.selectedCell, 'markdown');
                    this.stateController.sendCommand(NativeCommandType.ChangeToMarkdown, 'keyboard');
                }
                break;
            case 'l':
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.toggleLineNumbers(this.state.selectedCell);
                    this.stateController.sendCommand(NativeCommandType.ToggleLineNumbers, 'keyboard');
                }
                break;
            case 'o':
                if (!this.state.focusedCell && this.state.selectedCell) {
                    e.stopPropagation();
                    this.stateController.toggleOutput(this.state.selectedCell);
                    this.stateController.sendCommand(NativeCommandType.ToggleOutput, 'keyboard');
                }
                break;
            case 'Enter':
                if (e.shiftKey) {
                    this.shiftEnterCell(cellId, e);
                } else if (e.ctrlKey) {
                    this.ctrlEnterCell(cellId, e);
                } else if (e.altKey) {
                    this.altEnterCell(cellId, e);
                } else {
                    this.enterCell(cellId, e);
                }
                break;
            case 'd':
                if (this.lastKeyPressed === 'd' && !this.state.focusedCell  && this.state.selectedCell) {
                    e.stopPropagation();
                    this.lastKeyPressed = undefined; // Reset it so we don't keep deleting
                    const cellToSelect = this.getPrevCellId(cellId) || this.getNextCellId(cellId);
                    this.stateController.deleteCell(cellId);
                    if (cellToSelect) {
                        this.moveSelection(cellToSelect);
                    }
                    this.stateController.sendCommand(NativeCommandType.DeleteCell, 'keyboard');
                }
                break;
            case 'a':
                if (isFocusedWhenNotSuggesting || !this.state.focusedCell) {
                    e.stopPropagation();
                    const cell = this.stateController.insertAbove(cellId, true);
                    this.moveSelection(cell!);
                    this.stateController.sendCommand(NativeCommandType.InsertAbove, 'keyboard');
                }
                break;
            case 'b':
                if (isFocusedWhenNotSuggesting || !this.state.focusedCell) {
                    e.stopPropagation();
                    const cell = this.stateController.insertBelow(cellId, true);
                    this.moveSelection(cell!);
                    this.stateController.sendCommand(NativeCommandType.InsertBelow, 'keyboard');
                }
                break;
            default:
                break;
        }

        this.lastKeyPressed = e.code;
    }

    private enterCell = (cellId: string, e: IKeyboardEvent) => {
        // If focused, then ignore this call. It should go to the focused cell instead.
        if (!this.state.focusedCell && !e.editorInfo && this.contentPanelRef && this.contentPanelRef.current) {
            e.stopPropagation();
            e.preventDefault();
            this.focusCell(cellId, true);
        }
    }

    private shiftEnterCell = (cellId: string, e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit and move to the next.
        this.runAndMove(cellId, e.editorInfo ? e.editorInfo.contents : undefined);

        this.stateController.sendCommand(NativeCommandType.RunAndMove, 'keyboard');
    }

    private altEnterCell = (cellId: string, e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit this cell
        this.runAndAdd(cellId, e.editorInfo ? e.editorInfo.contents : undefined);

        this.stateController.sendCommand(NativeCommandType.RunAndAdd, 'keyboard');
    }

    private runAndMove(cellId: string, possibleContents?: string) {
        // Submit this cell
        this.submitCell(cellId, possibleContents);

        // Move to the next cell if we have one and give it focus
        let nextCell = this.getNextCellId(cellId);
        if (!nextCell) {
            // At the bottom insert a cell to move to instead
            nextCell = this.stateController.insertBelow(cellId, true);
        }
        if (nextCell) {
            this.moveSelection(nextCell);
        }
    }

    private runAndAdd(cellId: string, possibleContents?: string) {
        // Submit this cell
        this.submitCell(cellId, possibleContents);

        // insert a cell below this one
        const nextCell = this.stateController.insertBelow(cellId, true);

        // On next update, move the new cell
        if (nextCell) {
            this.moveSelection(nextCell);
        }
    }

    private ctrlEnterCell = (cellId: string, e: IKeyboardEvent) => {
        // Prevent shift enter from add an enter
        e.stopPropagation();
        e.preventDefault();

        // Submit this cell
        this.submitCell(cellId, e.editorInfo ? e.editorInfo.contents : undefined);
        this.stateController.sendCommand(NativeCommandType.Run, 'keyboard');
    }

    private moveSelectionToExisting = (cellId: string) => {
        // Cell should already exist in the UI
        if (this.contentPanelRef && this.contentPanelRef.current) {
            const wasFocused = this.state.focusedCell;
            this.stateController.selectCell(cellId, wasFocused ? cellId : undefined);
            this.focusCell(cellId, wasFocused ? true : false);
        }
    }

    private moveSelection = (cellId: string) => {
        // Check to see that this cell already exists in our window (it's part of the rendered state
        const cells = this.getNonMessageCells();
        if (!cells || !cells.find(c => c.id === cellId)) {
            // Force selection change right now as we don't need the cell to exist
            // to make it selected (otherwise we'll get a flash)
            const wasFocused = this.state.focusedCell;
            this.stateController.selectCell(cellId, wasFocused ? cellId : undefined);

            // Then wait to give it actual input focus
            setTimeout(() => this.moveSelectionToExisting(cellId), 1);
        } else {
            this.moveSelectionToExisting(cellId);
        }
    }

    private submitCell = (cellId: string, possibleContents?: string) => {
        let content: string | undefined ;
        const cellVM = this.findCellViewModel(cellId);

        // If inside editor, submit this code
        if (possibleContents) {
            content = possibleContents;
        } else if (cellVM) {
            // Outside editor, just use the cell
            content = concatMultilineString(cellVM.cell.data.source);
        }

        // Send to jupyter
        if (cellVM && content) {
            this.stateController.submitInput(content, cellVM);
        }
    }

    private getNextCellId(cellId: string): string | undefined {
        const cells = this.getNonMessageCells();

        // Find the next cell to move to
        const index = cells.findIndex(c => c.id === cellId);
        let nextCellId: string | undefined;
        if (index >= 0) {
            if (index < cells.length - 1) {
                nextCellId = cells[index + 1].id;
            } else if (this.state.editCellVM) {
                nextCellId = this.state.editCellVM.cell.id;
            }
        }

        return nextCellId;
    }

    private getPrevCellId(cellId: string): string | undefined {
        const cells = this.getNonMessageCells();
        let index = cells.findIndex(c => c.id === cellId);
        // Might also be the edit cell
        if (this.state.editCellVM && cellId === this.state.editCellVM.cell.id) {
            index = cells.length;
        }
        if (index > 0) {
            return cells[index - 1].id;
        }
        return undefined;
    }

    private arrowUpFromCell = (cellId: string, e: IKeyboardEvent) => {
        const prevCellId = this.getPrevCellId(cellId);
        if (prevCellId && this.contentPanelRef.current) {
            e.stopPropagation();
            this.moveSelection(prevCellId);
        }

        this.stateController.sendCommand(NativeCommandType.ArrowUp, 'keyboard');
    }

    private arrowDownFromCell = (cellId: string, e: IKeyboardEvent) => {
        const nextCellId = this.getNextCellId(cellId);

        if (nextCellId && this.contentPanelRef.current) {
            e.stopPropagation();
            this.moveSelection(nextCellId);
        }

        this.stateController.sendCommand(NativeCommandType.ArrowDown, 'keyboard');
    }

    private clickCell = (cellId: string) => {
        this.lastKeyPressed = undefined;
        const focusedCell = cellId === this.state.focusedCell ? cellId : undefined;
        this.stateController.selectCell(cellId, focusedCell);
    }

    private doubleClickCell = (cellId: string) => {
        this.focusCell(cellId, true);
    }

    private escapeCell = (cellId: string, e: IKeyboardEvent) => {
        // Unfocus the current cell by giving focus to the cell itself
        if (this.contentPanelRef && this.contentPanelRef.current) {
            e.stopPropagation();
            this.focusCell(cellId, false);
            this.stateController.sendCommand(NativeCommandType.Unfocus, 'keyboard');
        }
    }

    // private copyToClipboard = (cellId: string) => {
    //     const cell = this.stateController.findCell(cellId);
    //     if (cell) {
    //         // Need to do this in this process so it copies to the user's clipboard and not
    //         // the remote clipboard where the extension is running
    //         const textArea = document.createElement('textarea');
    //         textArea.value = concatMultilineString(cell.cell.data.source);
    //         document.body.appendChild(textArea);
    //         textArea.select();
    //         document.execCommand('Copy');
    //         textArea.remove();
    //     }
    // }

    // private pasteFromClipboard = (cellId: string) => {
    //     const editedCells = this.state.cellVMs;
    //     const index = editedCells.findIndex(x => x.cell.id === cellId) + 1;

    //     if (index > -1) {
    //         const textArea = document.createElement('textarea');
    //         document.body.appendChild(textArea);
    //         textArea.select();
    //         document.execCommand('Paste');
    //         editedCells[index].cell.data.source = textArea.value.split(/\r?\n/);
    //         textArea.remove();
    //     }

    //     this.setState({
    //         cellVMs: editedCells
    //     });
    // }

    private moveCellUp = (cellId?: string) => {
        if (this.contentPanelRef.current && cellId) {
            const wasFocused = this.state.focusedCell;
            this.stateController.moveCellUp(cellId);
            setTimeout(() => this.focusCell(cellId, wasFocused ? true : false), 1);
        }
    }

    private moveCellDown = (cellId?: string) => {
        if (this.contentPanelRef.current && cellId) {
            const wasFocused = this.state.focusedCell;
            this.stateController.moveCellDown(cellId);
            setTimeout(() => this.focusCell(cellId, wasFocused ? true : false), 1);
        }
    }

    private renderCell = (cellVM: ICellViewModel, index: number): JSX.Element | null => {
        const cellRef : React.RefObject<NativeCell> = React.createRef<NativeCell>();
        const containerRef = React.createRef<HTMLDivElement>();
        this.cellRefs.set(cellVM.cell.id, cellRef);
        this.cellContainerRefs.set(cellVM.cell.id, containerRef);

        // Special case, see if our initial load is finally complete.
        if (this.state.loadTotal && this.cellRefs.size >= this.state.loadTotal && !this.initialVisibilityUpdate) {
            // We are finally at the point where we have rendered all visible cells. Try fixing up their visible state
            this.initialVisibilityUpdate = true;
            this.debounceUpdateVisibleCells();
        }
        return (
            <div key={index} id={cellVM.cell.id} ref={containerRef}>
                <ErrorBoundary key={index}>
                    <NativeCell
                        ref={cellRef}
                        role='listitem'
                        editorOptions={this.state.editorOptions}
                        history={undefined}
                        maxTextSize={getSettings().maxOutputSize}
                        autoFocus={false}
                        testMode={this.props.testMode}
                        cellVM={cellVM}
                        baseTheme={this.props.baseTheme}
                        codeTheme={this.props.codeTheme}
                        showWatermark={false}
                        onCodeChange={this.stateController.codeChange}
                        onCodeCreated={this.stateController.editableCodeCreated}
                        monacoTheme={this.state.monacoTheme}
                        openLink={this.stateController.openLink}
                        expandImage={this.stateController.showPlot}
                        renderCellToolbar={this.renderCellToolbar}
                        keyDown={this.keyDownCell}
                        onClick={this.clickCell}
                        onDoubleClick={this.doubleClickCell}
                        focusedCell={this.state.focusedCell}
                        selectedCell={this.state.selectedCell}
                        focused={this.codeGotFocus}
                        unfocused={this.codeLostFocus}
                        showLineNumbers={cellVM.showLineNumbers}
                        hideOutput={cellVM.hideOutput}
                    />
                </ErrorBoundary>
            </div>);
    }

    private focusCell = (cellId: string, focusCode: boolean): void => {
        const ref = this.cellRefs.get(cellId);
        if (ref && ref.current) {
            ref.current.giveFocus(focusCode);
        }
    }
    // tslint:disable-next-line: max-func-body-length
    private renderNormalCellToolbar(cellId: string): JSX.Element[] | null {
        const cell = this.state.cellVMs.find(cvm => cvm.cell.id === cellId);
        if (cell) {
            const deleteCell = () => {
                this.stateController.deleteCell(cellId);
                this.stateController.sendCommand(NativeCommandType.DeleteCell, 'mouse');
            };
            const runCell = () => {
                this.stateController.updateCellSource(cellId);
                this.stateController.submitInput(concatMultilineString(cell.cell.data.source), cell);
                this.focusCell(cellId, false);
                this.stateController.sendCommand(NativeCommandType.Run, 'mouse');
            };
            const moveUp = () => {
                this.moveCellUp(cellId);
                this.stateController.sendCommand(NativeCommandType.MoveCellUp, 'mouse');
            };
            const moveDown = () => {
                this.moveCellDown(cellId);
                this.stateController.sendCommand(NativeCommandType.MoveCellDown, 'mouse');
            };
            const canMoveUp = this.stateController.canMoveUp(cellId);
            const canMoveDown = this.stateController.canMoveDown(cellId);
            const runAbove = () => {
                this.stateController.runAbove(cellId);
                this.stateController.sendCommand(NativeCommandType.RunAbove, 'mouse');
            };
            const runBelow = () => {
                this.stateController.runBelow(cellId);
                this.stateController.sendCommand(NativeCommandType.RunBelow, 'mouse');
            };
            const canRunAbove = this.stateController.canRunAbove(cellId);
            const canRunBelow = cell.cell.state === CellState.finished || cell.cell.state === CellState.error;
            const insertAbove = () => {
                this.stateController.insertAbove(cellId, true);
                this.stateController.sendCommand(NativeCommandType.InsertAbove, 'mouse');
            };
            const insertBelow = () => {
                this.stateController.insertBelow(cellId, true);
                this.stateController.sendCommand(NativeCommandType.InsertBelow, 'mouse');
            };
            const runCellHidden = !canRunBelow;
            const flyoutClass = cell.cell.id === this.state.focusedCell ? 'native-editor-cellflyout native-editor-cellflyout-focused'
                : 'native-editor-cellflyout native-editor-cellflyout-selected';
            const switchTooltip = cell.cell.data.cell_type === 'code' ? getLocString('DataScience.switchToMarkdown', 'Change to markdown') :
                getLocString('DataScience.switchToCode', 'Change to code');
            const switchImage = cell.cell.data.cell_type === 'code' ? ImageName.SwitchToMarkdown : ImageName.SwitchToCode;
            const switchCell = cell.cell.data.cell_type === 'code' ? () => {
                this.stateController.changeCellType(cellId, 'markdown');
                this.stateController.sendCommand(NativeCommandType.ChangeToMarkdown, 'mouse');
            } : () => {
                this.stateController.changeCellType(cellId, 'code');
                this.stateController.sendCommand(NativeCommandType.ChangeToCode, 'mouse');
            };
            const outerPortion =
                <div className='native-editor-celltoolbar-outer' key={0}>
                    <Flyout buttonClassName='native-editor-flyout-button' buttonContent={<span className='flyout-button-content'>...</span>} flyoutContainerName={flyoutClass}>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={moveUp} disabled={!canMoveUp} tooltip={getLocString('DataScience.moveCellUp', 'Move cell up')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Up} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={moveDown} disabled={!canMoveDown} tooltip={getLocString('DataScience.moveCellDown', 'Move cell down')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Down} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={runAbove} disabled={!canRunAbove} tooltip={getLocString('DataScience.runAbove', 'Run cells above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={runBelow} disabled={!canRunBelow} tooltip={getLocString('DataScience.runBelow', 'Run cell and below')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunBelow} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={insertAbove} tooltip={getLocString('DataScience.insertAbove', 'Insert cell above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={insertBelow} tooltip={getLocString('DataScience.insertBelow', 'Insert cell below')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={switchCell} tooltip={switchTooltip}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={switchImage} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={deleteCell} tooltip={getLocString('DataScience.deleteCell', 'Delete cell')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Delete} />
                        </ImageButton>
                    </Flyout>
                </div>;

            const innerPortion =
                <div className='native-editor-celltoolbar-inner' key={1}>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runCell} hidden={runCellHidden} tooltip={getLocString('DataScience.runCell', 'Run cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Run} />
                    </ImageButton>
                </div>;

            if (cell.cell.data.cell_type === 'code') {
                return [innerPortion, outerPortion];
            }

            return [outerPortion];
        }

        return null;
    }

    private renderEditCellToolbar() {
        const cell = this.state.editCellVM;
        if (cell) {
            const runCell = () => {
                this.stateController.submitInput(concatMultilineString(cell.cell.data.source), cell);
                this.stateController.sendCommand(NativeCommandType.Run, 'mouse');
            };
            const runAbove = () => {
                this.stateController.runAbove(Identifiers.EditCellId);
                this.stateController.sendCommand(NativeCommandType.RunAbove, 'mouse');
            };
            const canRunAbove = this.stateController.canRunAbove(Identifiers.EditCellId);
            const insertAbove = () => {
                this.stateController.insertAbove(Identifiers.EditCellId);
                this.stateController.sendCommand(NativeCommandType.InsertAbove, 'mouse');
            };
            const flyoutClass = cell.cell.id === this.state.focusedCell ? 'native-editor-cellflyout native-editor-cellflyout-focused'
                : 'native-editor-cellflyout native-editor-cellflyout-selected';
            const switchTooltip = cell.cell.data.cell_type === 'code' ? getLocString('DataScience.switchToMarkdown', 'Change to markdown') :
                getLocString('DataScience.switchToCode', 'Change to code');
            const switchImage = cell.cell.data.cell_type === 'code' ? ImageName.SwitchToMarkdown : ImageName.SwitchToCode;
            const switchCell = cell.cell.data.cell_type === 'code' ? () => {
                this.stateController.changeCellType(Identifiers.EditCellId, 'markdown');
                this.stateController.sendCommand(NativeCommandType.ChangeToMarkdown, 'mouse');
             } : () => {
                 this.stateController.changeCellType(Identifiers.EditCellId, 'code');
                 this.stateController.sendCommand(NativeCommandType.ChangeToCode, 'mouse');
             };
             const outerPortion =
                <div className='native-editor-celltoolbar-outer' key={0}>
                    <Flyout buttonClassName='native-editor-flyout-button' buttonContent={<span>...</span>} flyoutContainerName={flyoutClass}>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={runAbove} disabled={!canRunAbove} tooltip={getLocString('DataScience.runAbove', 'Run cells above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={insertAbove} tooltip={getLocString('DataScience.insertAbove', 'Insert cell above')}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertAbove} />
                        </ImageButton>
                        <ImageButton baseTheme={this.props.baseTheme} onClick={switchCell} tooltip={switchTooltip}>
                            <Image baseTheme={this.props.baseTheme} class='image-button-image' image={switchImage} />
                        </ImageButton>
                    </Flyout>
                </div>;

            const innerPortion =
                <div className='native-editor-celltoolbar-inner' key={1}>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runCell} hidden={false} tooltip={getLocString('DataScience.runCell', 'Run cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Run} />
                    </ImageButton>
                </div>;

            if (cell.cell.data.cell_type === 'code') {
                return [innerPortion, outerPortion];
            }

            return [outerPortion];
        }

        return null;
    }

    private renderCellToolbar = (cellId: string): JSX.Element[] | null => {
        if (cellId !== Identifiers.EditCellId) {
            return this.renderNormalCellToolbar(cellId);
        } else {
            return this.renderEditCellToolbar();
        }
    }

    private scrollDiv = (div: HTMLDivElement) => {
        if (this.state.newCell) {
            const newCell = this.state.newCell;
            this.stateController.setState({newCell: undefined});
            // Bounce this so state has time to update.
            setTimeout(() => {
                div.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
                this.focusCell(newCell, true);
            }, 10);
        }
    }

    private codeLostFocus = (cellId: string) => {
        this.stateController.codeLostFocus(cellId);
    }

    private codeGotFocus = (cellId: string) => {
        this.stateController.codeGotFocus(cellId);
    }

}
