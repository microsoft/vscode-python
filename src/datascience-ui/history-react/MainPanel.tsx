// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './mainPanel.css';

import { min } from 'lodash';
import * as React from 'react';

import { concatMultilineString } from '../../client/datascience/common';
import { HistoryMessages } from '../../client/datascience/constants';
import { CellState, ICell, IHistoryInfo } from '../../client/datascience/types';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { getLocString } from '../react-common/locReactSide';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { Progress } from '../react-common/progress';
import { RelativeImage } from '../react-common/relativeImage';
import { Cell, ICellViewModel } from './cell';
import { CellButton } from './cellButton';
import { createCellVM, generateTestState, IMainPanelState } from './mainPanelState';
import { MenuBar } from './menuBar';

export interface IMainPanelProps {
    skipDefault?: boolean;
    ignoreProgress? : boolean;
    theme: string;
}

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private stackLimit = 10;

    private bottom: HTMLDivElement | undefined;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, state: IMainPanelState) {
        super(props);

        // Default state should show a busy message
        this.state = { cellVMs: [], busy: true, undoStack: [], redoStack : [] };

        if (!this.props.skipDefault) {
            this.state = generateTestState(this.inputBlockToggled);
        }
    }

    public componentDidMount() {
        this.scrollToBottom();
    }

    public componentDidUpdate(prevProps, prevState) {
        this.sendInfo();
        this.scrollToBottom();
    }

    public render() {

        const clearButtonImage = this.props.theme !== 'vscode-dark' ? './images/Cancel/Cancel_16xMD_vscode.svg' :
        './images/Cancel/Cancel_16xMD_vscode_dark.svg';
        const redoImage = this.props.theme !== 'vscode-dark' ? './images/Redo/Redo_16x_vscode.svg' :
        './images/Redo/Redo_16x_vscode_dark.svg';
        const undoImage = this.props.theme !== 'vscode-dark' ? './images/Undo/Undo_16x_vscode.svg' :
        './images/Undo/Undo_16x_vscode_dark.svg';
        const restartImage = this.props.theme !== 'vscode-dark' ? './images/Restart/Restart_grey_16x_vscode.svg' :
        './images/Restart/Restart_grey_16x_vscode_dark.svg';
        const saveAsImage = this.props.theme !== 'vscode-dark' ? './images/SaveAs/SaveAs_16x_vscode.svg' :
        './images/SaveAs/SaveAs_16x_vscode_dark.svg';
        const collapseAllImage = this.props.theme !== 'vscode-dark' ? './images/CollapseAll/CollapseAll_16x_vscode.svg' :
        './images/CollapseAll/CollapseAll_16x_vscode_dark.svg';
        const expandAllImage = this.props.theme !== 'vscode-dark' ? './images/ExpandAll/ExpandAll_16x_vscode.svg' :
        './images/ExpandAll/ExpandAll_16x_vscode_dark.svg';
        const interruptImage = this.props.theme !== 'vscode-dark' ? './images/Interrupt/Interrupt_16x_vscode.svg' :
        './images/Interrupt/Interrupt_16x_vscode_dark.svg';

        const progressBar = this.state.busy && !this.props.ignoreProgress ? <Progress /> : undefined;

        return (
            <div className='main-panel'>
                <PostOffice messageHandlers={[this]} />
                <MenuBar theme={this.props.theme} stylePosition='top-fixed'>
                    {this.renderExtraButtons()}
                    <CellButton theme={this.props.theme} onClick={this.collapseAll} disabled={!this.canCollapseAll()} tooltip={getLocString('DataScience.collapseAll', 'Collapse all cell inputs')}>
                        <RelativeImage class='cell-button-image' path={collapseAllImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.expandAll} disabled={!this.canExpandAll()} tooltip={getLocString('DataScience.expandAll', 'Expand all cell inputs')}>
                        <RelativeImage class='cell-button-image' path={expandAllImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.export} disabled={!this.canExport()} tooltip={getLocString('DataScience.export', 'Export as Jupyter Notebook')}>
                        <RelativeImage class='cell-button-image' path={saveAsImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.restartKernel} tooltip={getLocString('DataScience.restartServer', 'Restart iPython Kernel')}>
                        <RelativeImage class='cell-button-image' path={restartImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.interruptKernel} tooltip={getLocString('DataScience.interruptKernel', 'Interrupt iPython Kernel')}>
                        <RelativeImage class='cell-button-image' path={interruptImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.undo} disabled={!this.canUndo()} tooltip={getLocString('DataScience.undo', 'Undo')}>
                        <RelativeImage class='cell-button-image' path={undoImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.redo} disabled={!this.canRedo()} tooltip={getLocString('DataScience.redo', 'Redo')}>
                        <RelativeImage class='cell-button-image' path={redoImage}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.clearAll} tooltip={getLocString('DataScience.clearAll', 'Remove All Cells')}>
                        <RelativeImage class='cell-button-image' path={clearButtonImage}/>
                    </CellButton>
                </MenuBar>
                <div className='top-spacing'/>
                {progressBar}
                {this.renderCells()}
                <div ref={this.updateBottom}/>
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case HistoryMessages.StartCell:
                this.addCell(payload);
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
                if (!this.props.ignoreProgress) {
                    this.setState({busy: true});
                }
                break;

            case HistoryMessages.StopProgress:
                if (!this.props.ignoreProgress) {
                    this.setState({busy: false});
                }
                break;

            default:
                break;
        }

        return false;
    }

    private getAllCells = () => {
        // Send all of our cells back to the other side
        const cells = this.state.cellVMs.map((cellVM : ICellViewModel) => {
            return cellVM.cell;
        }) ;

        PostOffice.sendMessage({type: HistoryMessages.ReturnAllCells, payload: { contents: cells }});
    }

    private renderExtraButtons = () => {
        if (!this.props.skipDefault) {
            return <CellButton theme={this.props.theme} onClick={this.addMarkdown} tooltip='Add Markdown Test'>M</CellButton>;
        }

        return null;
    }

    private renderCells = () => {
        return this.state.cellVMs.map((cellVM: ICellViewModel, index: number) =>
            <ErrorBoundary key={index}>
                <Cell
                    cellVM={cellVM}
                    theme={this.props.theme}
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

    private collapseAll = () => {
        PostOffice.sendMessage({ type: HistoryMessages.CollapseAll, payload: { }});
        this.collapseAllSilent();
    }

    private collapseAllSilent = () => {
        const newCells = this.state.cellVMs.map((value: ICellViewModel) => {
            if (value.inputBlockOpen) {
                return this.toggleCellVM(value);
            } else {
                return {...value};
            }
        });

        // Now assign our new array copy to state
        this.setState({
            cellVMs: newCells,
            skipNextScroll: true
        });
    }

    private expandAll = () => {
        PostOffice.sendMessage({ type: HistoryMessages.ExpandAll, payload: { }});
        this.expandAllSilent();
    }

    private expandAllSilent = () => {
        const newCells = this.state.cellVMs.map((value: ICellViewModel) => {
            if (!value.inputBlockOpen) {
                return this.toggleCellVM(value);
            } else {
                return {...value};
            }
        });

        // Now assign our new array copy to state
        this.setState({
            cellVMs: newCells,
            skipNextScroll: true
        });
    }

    private canCollapseAll = () => {
        return this.state.cellVMs.length > 0;
    }

    private canExpandAll = () => {
        return this.state.cellVMs.length > 0;
    }

    private canExport = () => {
        return this.state.cellVMs.length > 0 ;
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
        PostOffice.sendMessage({ type: HistoryMessages.GotoCodeCell, payload: { file : cellVM.cell.file, line: cellVM.cell.line }});
    }

    private deleteCell = (index: number) => {
        PostOffice.sendMessage({ type: HistoryMessages.DeleteCell, payload: { }});

        // Update our state
        this.setState({
            cellVMs: this.state.cellVMs.filter((c : ICellViewModel, i: number) => {
                return i !== index;
            }),
            undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true
        });
    }

    private clearAll = () => {
        PostOffice.sendMessage({ type: HistoryMessages.DeleteAllCells, payload: { }});
        this.clearAllSilent();
    }

    private clearAllSilent = () => {
        // Update our state
        this.setState({
            cellVMs: [],
            undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true,
            busy: false // No more progress on delete all
        });
    }

    private redo = () => {
        // Pop one off of our redo stack and update our undo
        const cells = this.state.redoStack[this.state.redoStack.length - 1];
        const redoStack = this.state.redoStack.slice(0, this.state.redoStack.length - 1);
        const undoStack = this.pushStack(this.state.undoStack, this.state.cellVMs);
        PostOffice.sendMessage({ type: HistoryMessages.Redo, payload: { }});
        this.setState({
            cellVMs: cells,
            undoStack: undoStack,
            redoStack: redoStack,
            skipNextScroll: true
        });
    }

    private undo = () => {
        // Pop one off of our undo stack and update our redo
        const cells = this.state.undoStack[this.state.undoStack.length - 1];
        const undoStack = this.state.undoStack.slice(0, this.state.undoStack.length - 1);
        const redoStack = this.pushStack(this.state.redoStack, this.state.cellVMs);
        PostOffice.sendMessage({ type: HistoryMessages.Undo, payload: { }});
        this.setState({
            cellVMs: cells,
            undoStack : undoStack,
            redoStack : redoStack,
            skipNextScroll : true
        });
    }

    private restartKernel = () => {
        // Send a message to the other side to restart the kernel
        PostOffice.sendMessage({ type: HistoryMessages.RestartKernel, payload: { }});
    }

    private interruptKernel = () => {
        // Send a message to the other side to restart the kernel
        PostOffice.sendMessage({ type: HistoryMessages.Interrupt, payload: { }});
    }

    private export = () => {
        // Send a message to the other side to export our current list
        const cellContents: ICell[] = this.state.cellVMs.map((cellVM: ICellViewModel, index: number) => { return cellVM.cell; });
        PostOffice.sendMessage({ type: HistoryMessages.Export, payload: { contents: cellContents }});
    }

    private scrollToBottom = () => {
        if (this.bottom && this.bottom.scrollIntoView && !this.state.skipNextScroll) {
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

    // tslint:disable-next-line:no-any
    private addCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            const cellVM: ICellViewModel = createCellVM(cell, this.inputBlockToggled);
            if (cellVM) {
                this.setState({
                    cellVMs: [...this.state.cellVMs, cellVM],
                    undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
                    redoStack: this.state.redoStack,
                    skipNextScroll: false
                });
            }
        }
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
            cellVMArray[cellVMIndex] = this.toggleCellVM(targetCellVM);

            this.setState({
                skipNextScroll: true,
                cellVMs: cellVMArray
            });
        }
    }

    // Toggle the input collapse state of a cell view model return a shallow copy with updated values
    private toggleCellVM = (cellVM: ICellViewModel) => {
        let newCollapseState = cellVM.inputBlockOpen;
        let newText = cellVM.inputBlockText;

        if (cellVM.cell.data.cell_type === 'code') {
            newCollapseState = !newCollapseState;
            newText = this.extractInputText(cellVM.cell);
            if (!newCollapseState) {
                if (newText.length > 0) {
                    newText = newText.split('\n', 1)[0];
                    newText = newText.slice(0, 255); // Slice to limit length of string, slicing past the string length is fine
                    newText = newText.concat('...');
                }
            }
        }

        return {...cellVM, inputBlockOpen: newCollapseState, inputBlockText: newText};
    }

    private extractInputText = (cell: ICell) => {
        return concatMultilineString(cell.data.source);
    }

    private sendInfo = () => {
        const info : IHistoryInfo = {
            cellCount: this.state.cellVMs.length,
            undoCount: this.state.undoStack.length,
            redoCount: this.state.redoStack.length
        };
        PostOffice.sendMessage({type: HistoryMessages.SendInfo, payload: { info: info }});
    }

    private updateOrAdd = (cell: ICell, allowAdd? : boolean) => {
        const index = this.state.cellVMs.findIndex((c : ICellViewModel) => c.cell.id === cell.id);
        if (index >= 0) {
            // Update this cell
            this.state.cellVMs[index].cell = cell;
            this.forceUpdate();
        } else if (allowAdd) {
            // This is an entirely new cell (it may have started out as finished)
            this.addCell(cell);
        }
    }

    // tslint:disable-next-line:no-any
    private finishCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell) {
                this.updateOrAdd(cell, true);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private updateCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell) {
                this.updateOrAdd(cell, false);
            }
        }
    }
}
