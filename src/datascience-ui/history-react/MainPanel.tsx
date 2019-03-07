// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './mainPanel.css';

import { min } from 'lodash';
import * as React from 'react';

import { CellMatcher } from '../../client/datascience/cellMatcher';
import { generateMarkdownFromCodeLines } from '../../client/datascience/common';
import { HistoryMessages, IHistoryMapping } from '../../client/datascience/historyTypes';
import { CellState, ICell, IHistoryInfo } from '../../client/datascience/types';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { getLocString } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { Progress } from '../react-common/progress';
import { getSettings, updateSettings } from '../react-common/settingsReactSide';
import { Cell, ICellViewModel } from './cell';
import { CellButton } from './cellButton';
import { Image, ImageName } from './image';
import { InputHistory } from './inputHistory';
import { createCellVM, createEditableCellVM, extractInputText, generateTestState, IMainPanelState } from './mainPanelState';
import { MenuBar } from './menuBar';

export interface IMainPanelProps {
    skipDefault?: boolean;
    testMode?: boolean;
    baseTheme: string;
    codeTheme: string;
}

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private stackLimit = 10;
    private bottom: HTMLDivElement | undefined;
    private updateCount = 0;
    private renderCount = 0;
    private sentStartup = false;
    private postOffice: PostOffice | undefined;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, state: IMainPanelState) {
        super(props);

        // Default state should show a busy message
        this.state = { cellVMs: [], busy: true, undoStack: [], redoStack : [], submittedText: false, history: new InputHistory()};

        // Add test state if necessary
        if (!this.props.skipDefault) {
            this.state = generateTestState(this.inputBlockToggled);
        }

        // Add a single empty cell if it's supported
        if (getSettings && getSettings().allowInput) {
            this.state.cellVMs.push(createEditableCellVM(1));
        }

    }

    public componentDidMount() {
        this.scrollToBottom();
    }

    public componentDidUpdate(prevProps: Readonly<IMainPanelProps>, prevState: Readonly<IMainPanelState>, snapshot?: {}) {
        this.scrollToBottom();

        // If in test mode, update our outputs
        if (this.props.testMode) {
            this.updateCount = this.updateCount + 1;
        }
    }

    public render() {

        // If in test mode, update our outputs
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        const progressBar = this.state.busy && !this.props.testMode ? <Progress /> : undefined;

        return (
            <div className='main-panel'>
                <PostOffice messageHandlers={[this]} ref={this.updatePostOffice} />
                <MenuBar baseTheme={this.props.baseTheme} stylePosition='top-fixed'>
                    {this.renderExtraButtons()}
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.collapseAll} disabled={!this.canCollapseAll()} tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.CollapseAll}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.expandAll} disabled={!this.canExpandAll()} tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.ExpandAll}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.export} disabled={!this.canExport()} tooltip={getLocString('DataScience.export', 'Export as Jupyter Notebook')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.SaveAs}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.restartKernel} tooltip={getLocString('DataScience.restartServer', 'Restart iPython Kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Restart}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.interruptKernel} tooltip={getLocString('DataScience.interruptKernel', 'Interrupt iPython Kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Interrupt}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.undo} disabled={!this.canUndo()} tooltip={getLocString('DataScience.undo', 'Undo')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Undo}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.redo} disabled={!this.canRedo()} tooltip={getLocString('DataScience.redo', 'Redo')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Redo}/>
                    </CellButton>
                    <CellButton baseTheme={this.props.baseTheme} onClick={this.clearAll} tooltip={getLocString('DataScience.clearAll', 'Remove All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='cell-button-image' image={ImageName.Cancel}/>
                    </CellButton>
                </MenuBar>
                <div className='top-spacing'/>
                {progressBar}
                <div className='cell-table'>
                    <div className='cell-table-body'>
                        {this.renderCells()}
                    </div>
                </div>
                <div ref={this.updateBottom}/>
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case HistoryMessages.StartCell:
                this.startCell(payload);
                return true;

            case HistoryMessages.FinishCell:
                this.finishCell(payload);
                return true;

            case HistoryMessages.UpdateCell:
                this.updateCell(payload);
                return true;

            case HistoryMessages.GetAllCells:
                this.getAllCells();
                return true;

            case HistoryMessages.ExpandAll:
                this.expandAllSilent();
                return true;

            case HistoryMessages.CollapseAll:
                this.collapseAllSilent();
                return true;

            case HistoryMessages.DeleteAllCells:
                this.clearAllSilent();
                return true;

            case HistoryMessages.Redo:
                this.redo();
                return true;

            case HistoryMessages.Undo:
                this.undo();
                return true;

            case HistoryMessages.StartProgress:
                if (!this.props.testMode) {
                    this.setState({busy: true});
                }
                break;

            case HistoryMessages.StopProgress:
                if (!this.props.testMode) {
                    this.setState({busy: false});
                }
                break;

            case HistoryMessages.UpdateSettings:
                this.updateSettings(payload);
                break;

            default:
                break;
        }

        return false;
    }

    // tslint:disable-next-line:no-any
    private updateSettings = (payload?: any) => {
        if (payload) {
            const prevShowInputs = getSettings().showCellInputCode;
            updateSettings(payload as string);

            // If our settings change updated show inputs we need to fix up our cells
            const showInputs = getSettings().showCellInputCode;

            if (prevShowInputs !== showInputs) {
                this.toggleCellInputVisibility(showInputs, getSettings().collapseCellInputCodeByDefault);
            }
        }
    }

    private sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) {
        if (this.postOffice) {
            this.postOffice.sendMessage(type, payload);
        }
    }

    private getAllCells = () => {
        // Send all of our cells back to the other side
        const cells = this.state.cellVMs.map((cellVM : ICellViewModel) => {
            return cellVM.cell;
        });

        this.sendMessage(HistoryMessages.ReturnAllCells, cells);
    }

    private renderExtraButtons = () => {
        if (!this.props.skipDefault) {
            return <CellButton baseTheme={this.props.baseTheme} onClick={this.addMarkdown} tooltip='Add Markdown Test'>M</CellButton>;
        }

        return null;
    }

    private renderCells = () => {
        const maxOutputSize = getSettings().maxOutputSize;
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;
        return this.state.cellVMs.map((cellVM: ICellViewModel, index: number) =>
            <ErrorBoundary key={index}>
                <Cell
                    history={cellVM.editable ? this.state.history : undefined}
                    maxTextSize={maxTextSize}
                    autoFocus={document.hasFocus()}
                    testMode={this.props.testMode}
                    cellVM={cellVM}
                    submitNewCode={this.submitInput}
                    baseTheme={this.props.baseTheme}
                    codeTheme={this.props.codeTheme}
                    showWatermark={!this.state.submittedText}
                    gotoCode={() => this.gotoCellCode(index)}
                    delete={() => this.deleteCell(index)}/>
            </ErrorBoundary>
        );
    }

    private addMarkdown = () => {
        this.addCell({
            data :         {
                cell_type: 'markdown',
                metadata: {},
                source: [
                    '## Cell 3\n',
                    'Here\'s some markdown\n',
                    '- A List\n',
                    '- Of Items'
                ]
            },
            id : '1111',
            file : 'foo.py',
            line : 0,
            state : CellState.finished
        });
    }

    private getNonEditCellVMs() : ICellViewModel [] {
        return this.state.cellVMs.filter(c => !c.editable);
    }

    private canCollapseAll = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    private canExpandAll = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    private canExport = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    private canRedo = () => {
        return this.state.redoStack.length > 0 ;
    }

    private canUndo = () => {
        return this.state.undoStack.length > 0 ;
    }

    private pushStack = (stack : ICellViewModel[][], cells : ICellViewModel[]) => {
        // Get the undo stack up to the maximum length
        const slicedUndo = stack.slice(0, min([stack.length, this.stackLimit]));

        // Combine this with our set of cells
        return [...slicedUndo, cells];
    }

    private gotoCellCode = (index: number) => {
        // Find our cell
        const cellVM = this.state.cellVMs[index];

        // Send a message to the other side to jump to a particular cell
        this.sendMessage(HistoryMessages.GotoCodeCell, { file : cellVM.cell.file, line: cellVM.cell.line });
    }

    private deleteCell = (index: number) => {
        this.sendMessage(HistoryMessages.DeleteCell);

        // Update our state
        this.setState({
            cellVMs: this.state.cellVMs.filter((c : ICellViewModel, i: number) => {
                return i !== index;
            }),
            undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true
        });
    }

    private collapseAll = () => {
        this.sendMessage(HistoryMessages.CollapseAll);
        this.collapseAllSilent();
    }

    private expandAll = () => {
        this.sendMessage(HistoryMessages.ExpandAll);
        this.expandAllSilent();
    }

    private clearAll = () => {
        this.sendMessage(HistoryMessages.DeleteAllCells);
        this.clearAllSilent();
    }

    private clearAllSilent = () => {
        // Make sure the edit cell doesn't go away
        const editCell = this.getEditCell();

        // Update our state
        this.setState({
            cellVMs: editCell ? [editCell] : [],
            undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true,
            busy: false // No more progress on delete all
        });

        // Tell other side, we changed our number of cells
        this.sendInfo();
    }

    private redo = () => {
        // Pop one off of our redo stack and update our undo
        const cells = this.state.redoStack[this.state.redoStack.length - 1];
        const redoStack = this.state.redoStack.slice(0, this.state.redoStack.length - 1);
        const undoStack = this.pushStack(this.state.undoStack, this.state.cellVMs);
        this.sendMessage(HistoryMessages.Redo);
        this.setState({
            cellVMs: cells,
            undoStack: undoStack,
            redoStack: redoStack,
            skipNextScroll: true
        });

        // Tell other side, we changed our number of cells
        this.sendInfo();
    }

    private undo = () => {
        // Pop one off of our undo stack and update our redo
        const cells = this.state.undoStack[this.state.undoStack.length - 1];
        const undoStack = this.state.undoStack.slice(0, this.state.undoStack.length - 1);
        const redoStack = this.pushStack(this.state.redoStack, this.state.cellVMs);
        this.sendMessage(HistoryMessages.Undo);
        this.setState({
            cellVMs: cells,
            undoStack : undoStack,
            redoStack : redoStack,
            skipNextScroll : true
        });

        // Tell other side, we changed our number of cells
        this.sendInfo();
    }

    private restartKernel = () => {
        // Send a message to the other side to restart the kernel
        this.sendMessage(HistoryMessages.RestartKernel);
    }

    private interruptKernel = () => {
        // Send a message to the other side to restart the kernel
        this.sendMessage(HistoryMessages.Interrupt);
    }

    private export = () => {
        // Send a message to the other side to export our current list
        const cellContents: ICell[] = this.state.cellVMs.map((cellVM: ICellViewModel, index: number) => { return cellVM.cell; });
        this.sendMessage(HistoryMessages.Export, cellContents);
    }

    private scrollToBottom = () => {
        if (this.bottom && this.bottom.scrollIntoView && !this.state.skipNextScroll && !this.props.testMode) {
            // Delay this until we are about to render. React hasn't setup the size of the bottom element
            // yet so we need to delay. 10ms looks good from a user point of view
            setTimeout(() => {
                if (this.bottom) {
                    this.bottom.scrollIntoView({behavior: 'smooth', block : 'end', inline: 'end'});
                }
            }, 100);
        }
    }

    private updateBottom = (newBottom: HTMLDivElement) => {
        if (newBottom !== this.bottom) {
            this.bottom = newBottom;
        }
    }

    private updatePostOffice = (postOffice: PostOffice) => {
        if (this.postOffice !== postOffice) {
            this.postOffice = postOffice;
            if (!this.sentStartup) {
                this.sentStartup = true;
                this.postOffice.sendMessage(HistoryMessages.Started);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private addCell = (payload?: any) => {
        // Get our settings for if we should display input code and if we should collapse by default
        const showInputs = getSettings().showCellInputCode;
        const collapseInputs = getSettings().collapseCellInputCodeByDefault;

        if (payload) {
            const cell = payload as ICell;
            let cellVM: ICellViewModel = createCellVM(cell, getSettings(), this.inputBlockToggled);

            // Set initial cell visibility and collapse
            cellVM = this.alterCellVM(cellVM, showInputs, !collapseInputs);

            if (cellVM) {
                let newList : ICellViewModel[] = [];

                // Insert before the edit cell if we have one
                const editCell = this.getEditCell();
                if (editCell) {
                    newList = [...this.state.cellVMs.filter(c => !c.editable), cellVM, editCell];

                    // Update execution count on the last cell
                    editCell.cell.data.execution_count = this.getInputExecutionCount(newList);
                } else {
                    newList = [...this.state.cellVMs, cellVM];
                }

                this.setState({
                    cellVMs: newList,
                    undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                    redoStack: this.state.redoStack,
                    skipNextScroll: false
                });

                // Tell other side, we changed our number of cells
                this.sendInfo();
            }
        }
    }

    private getEditCell() : ICellViewModel | undefined {
        const editCells = this.state.cellVMs.filter(c => c.editable);
        if (editCells && editCells.length === 1) {
            return editCells[0];
        }

        return undefined;
    }

    private inputBlockToggled = (id: string) => {
        // Create a shallow copy of the array, let not const as this is the shallow array copy that we will be changing
        const cellVMArray: ICellViewModel[] = [...this.state.cellVMs];
        const cellVMIndex = cellVMArray.findIndex((value: ICellViewModel) => {
            return value.cell.id === id;
        });

        if (cellVMIndex >= 0) {
            // Const here as this is the state object pulled off of our shallow array copy, we don't want to mutate it
            const targetCellVM = cellVMArray[cellVMIndex];

            // Mutate the shallow array copy
            cellVMArray[cellVMIndex] = this.alterCellVM(targetCellVM, true, !targetCellVM.inputBlockOpen);

            this.setState({
                skipNextScroll: true,
                cellVMs: cellVMArray
            });
        }
    }

    private toggleCellInputVisibility = (visible: boolean, collapse: boolean) => {
        this.alterAllCellVMs(visible, !collapse);
    }

    private collapseAllSilent = () => {
        if (getSettings().showCellInputCode) {
            this.alterAllCellVMs(true, false);
        }
    }

    private expandAllSilent = () => {
        if (getSettings().showCellInputCode) {
            this.alterAllCellVMs(true, true);
        }
    }

    private alterAllCellVMs = (visible: boolean, expanded: boolean) => {
        const newCells = this.state.cellVMs.map((value: ICellViewModel) => {
            return this.alterCellVM(value, visible, expanded);
        });

        this.setState({
            skipNextScroll: true,
            cellVMs: newCells
        });
    }

    // Adjust the visibility or collapsed state of a cell
    private alterCellVM = (cellVM: ICellViewModel, visible: boolean, expanded: boolean) => {
        if (cellVM.cell.data.cell_type === 'code') {
            // If we are already in the correct state, return back our initial cell vm
            if (cellVM.inputBlockShow === visible && cellVM.inputBlockOpen === expanded) {
                return cellVM;
            }

            const newCellVM = {...cellVM};
            if (cellVM.inputBlockShow !== visible) {
                if (visible) {
                    // Show the cell, the rest of the function will add on correct collapse state
                    newCellVM.inputBlockShow = true;
                } else {
                    // Hide this cell
                    newCellVM.inputBlockShow = false;
                }
            }

            // No elseif as we want newly visible cells to pick up the correct expand / collapse state
            if (cellVM.inputBlockOpen !== expanded && cellVM.inputBlockCollapseNeeded && cellVM.inputBlockShow) {
                if (expanded) {
                    // Expand the cell
                    const newText = extractInputText(cellVM.cell, getSettings());

                    newCellVM.inputBlockOpen = true;
                    newCellVM.inputBlockText = newText;
                } else {
                    // Collapse the cell
                    let newText = extractInputText(cellVM.cell, getSettings());
                    if (newText.length > 0) {
                        newText = newText.split('\n', 1)[0];
                        newText = newText.slice(0, 255); // Slice to limit length, slicing past length is fine
                        newText = newText.concat('...');
                    }

                    newCellVM.inputBlockOpen = false;
                    newCellVM.inputBlockText = newText;
                }
            }

            return newCellVM;
        }

        return cellVM;
    }

    private sendInfo = () => {
        const info : IHistoryInfo = {
            cellCount: this.getNonEditCellVMs().length,
            undoCount: this.state.undoStack.length,
            redoCount: this.state.redoStack.length
        };
        this.sendMessage(HistoryMessages.SendInfo, info);
    }

    private updateOrAdd = (cell: ICell, allowAdd? : boolean) => {
        const index = this.state.cellVMs.findIndex((c : ICellViewModel) => {
            return c.cell.id === cell.id &&
                   c.cell.line === cell.line &&
                   c.cell.file === cell.file;
            });
        if (index >= 0) {
            // Update this cell
            this.state.cellVMs[index].cell = cell;

            // Also update the last cell execution count. It may have changed
            const editCell = this.getEditCell();
            if (editCell) {
                editCell.cell.data.execution_count = this.getInputExecutionCount(this.state.cellVMs);
            }

            this.forceUpdate();
        } else if (allowAdd) {
            // This is an entirely new cell (it may have started out as finished)
            this.addCell(cell);
        }
    }

    private isCellSupported(cell: ICell) : boolean {
        return !this.props.testMode || cell.data.cell_type !== 'sys_info';
    }

    // tslint:disable-next-line:no-any
    private finishCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, true);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private startCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, true);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private updateCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, false);
            }
        }
    }

    private getInputExecutionCount(cellVMs: ICellViewModel[]) : number {
        const realCells = cellVMs.filter(c => c.cell.data.cell_type === 'code' && !c.editable && c.cell.data.execution_count);
        return realCells && realCells.length > 0 ? parseInt(realCells[realCells.length - 1].cell.data.execution_count!.toString(), 10) + 1 : 1;
    }

    private submitInput = (code: string) => {
        // This should be from our last entry. Switch this entry to read only, and add a new item to our list
        let editCell = this.getEditCell();
        if (editCell) {
            // Save a copy of the ones without edits.
            const withoutEdits = this.state.cellVMs.filter(c => !c.editable);

            // Change this editable cell to not editable.
            editCell.cell.state = CellState.executing;
            editCell.cell.data.source = code;

            // Change type to markdown if necessary
            const split = code.splitLines({trim: false});
            const firstLine = split[0];
            const matcher = new CellMatcher(getSettings());
            if (matcher.isMarkdown(firstLine)) {
                editCell.cell.data.cell_type = 'markdown';
                editCell.cell.data.source = generateMarkdownFromCodeLines(split);
                editCell.cell.state = CellState.finished;
            }

            // Update input controls (always show expanded since we just edited it.)
            editCell = createCellVM(editCell.cell, getSettings(), this.inputBlockToggled);
            const collapseInputs = getSettings().collapseCellInputCodeByDefault;
            editCell = this.alterCellVM(editCell, true, !collapseInputs);

            // Indicate this is direct input so that we don't hide it if the user has
            // hide all inputs turned on.
            editCell.directInput = true;

            // Stick in a new cell at the bottom that's editable and update our state
            // so that the last cell becomes busy
            this.setState({
                cellVMs: [...withoutEdits, editCell, createEditableCellVM(this.getInputExecutionCount(withoutEdits))],
                undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
                redoStack: this.state.redoStack,
                skipNextScroll: false,
                submittedText: true
            });

            // Send a message to execute this code if necessary.
            if (editCell.cell.state !== CellState.finished) {
                this.sendMessage(HistoryMessages.SubmitNewCell, { code, id: editCell.cell.id });
            }
        }
    }
}
