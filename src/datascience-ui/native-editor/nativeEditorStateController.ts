// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as uuid from 'uuid/v4';

import { noop } from '../../client/common/utils/misc';
import { concatMultilineStringInput } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import {
    ILoadAllCells,
    InteractiveWindowMessages,
    NativeCommandType
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { createEmptyCell, extractInputText, ICellViewModel } from '../interactive-common/mainState';
import { IMainStateControllerProps, MainStateController } from '../interactive-common/mainStateController';
import { getSettings } from '../react-common/settingsReactSide';

export class NativeEditorStateController extends MainStateController {
    private waitingForLoadRender: boolean = false;

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainStateControllerProps) {
        super(props);
    }
    // tslint:disable-next-line: no-any
    public handleMessage(msg: string, payload?: any) {
        // Handle message before base class so we will
        // have our state set before the next render.
        switch (msg) {
            case InteractiveWindowMessages.NotebookDirty:
                // Indicate dirty
                this.setState({ dirty: true });
                break;

            case InteractiveWindowMessages.NotebookClean:
                // Indicate dirty
                this.setState({ dirty: false });
                break;

            case InteractiveWindowMessages.LoadAllCells:
                this.waitingForLoadRender = true;
                break;

            case InteractiveWindowMessages.NotebookRunAllCells:
                this.runAll();
                break;

            case InteractiveWindowMessages.NotebookRunSelectedCell:
                this.runSelectedCell();
                break;

            case InteractiveWindowMessages.NotebookAddCellBelow:
                this.addNewCell();
                break;
            case InteractiveWindowMessages.DoSave:
                this.save();
                break;

            default:
                break;
        }

        return super.handleMessage(msg, payload);
    }

    // This method is used by tests to prepare this react control for loading again.
    public reset() {
        this.waitingForLoadRender = false;
        this.setState({ busy: true });
    }

    public canMoveUp = (cellId?: string) => {
        const index = this.getState().cellVMs.findIndex(cvm => cvm.cell.id === cellId);
        return (index > 0);
    }

    public canMoveDown = (cellId?: string) => {
        const index = this.getState().cellVMs.findIndex(cvm => cvm.cell.id === cellId);
        return (index < this.getState().cellVMs.length - 1);
    }

    public canRunAbove = (cellId?: string) => {
        const cells = this.getState().cellVMs;
        const index = cellId === Identifiers.EditCellId ? cells.length : cells.findIndex(cvm => cvm.cell.id === cellId);

        // Any code cells above, we can run above
        return index > 0 && cells.find((cvm, i) => i < index && cvm.cell.data.cell_type === 'code');
    }

    public canRunBelow = (cellId?: string) => {
        const cells = this.getState().cellVMs;
        const index = cells.findIndex(cvm => cvm.cell.id === cellId);

        // Any code cells below, we can run below
        return index > 0 && cells.find((cvm, i) => i >= index && cvm.cell.data.cell_type === 'code');
    }

    public runSelectedCell = () => {
        const selectedCellId = this.getState().selectedCellId;

        if (selectedCellId) {
            const cells = this.getState().cellVMs;
            const selectedCell = cells.find(cvm => cvm.cell.id === selectedCellId);
            if (selectedCell) {
                this.submitInput(concatMultilineStringInput(selectedCell.cell.data.source), selectedCell);
            }
        }
    }

    public runAll = () => {
        // Run all code cells (markdown don't need to be run)
        this.suspendUpdates();
        const cells = this.getState().cellVMs;
        cells.filter(cvm => cvm.cell.data.cell_type === 'code').
            forEach(cvm => this.submitInput(concatMultilineStringInput(cvm.cell.data.source), cvm));
        this.resumeUpdates();
    }

    public addNewCell = (): ICellViewModel | undefined => {
        const cells = this.getState().cellVMs;
        const selectedCell = this.getState().selectedCellId;
        this.suspendUpdates();
        const id = uuid();
        const pos = selectedCell ? cells.findIndex(cvm => cvm.cell.id === this.getState().selectedCellId) + 1 : cells.length;
        this.setState({ newCell: id });
        const vm = this.insertCell(createEmptyCell(id, null), pos);
        this.sendMessage(InteractiveWindowMessages.InsertCell, { cell: vm.cell, index: pos, code: '', codeCellAboveId: this.firstCodeCellAbove(id) });
        if (vm) {
            // Make sure the new cell is monaco
            vm.useQuickEdit = false;
        }
        this.resumeUpdates();
        return vm;
    }

    public possiblyDeleteCell = (cellId: string) => {
        const cells = this.getState().cellVMs;
        if (cells.length === 1 && cells[0].cell.id === cellId) {
            // Special case, if this is the last cell, don't delete it, just clear it's output and input
            const newVM: ICellViewModel = {
                cell: createEmptyCell(cellId, null),
                editable: true,
                inputBlockOpen: true,
                inputBlockShow: true,
                inputBlockText: '',
                inputBlockCollapseNeeded: false,
                inputBlockToggled: noop,
                selected: cells[0].selected,
                focused: cells[0].focused
            };
            this.setState({ cellVMs: [newVM], undoStack: this.pushStack(this.getState().undoStack, cells) });

            // Send messages to other side to indicate the new add
            this.sendMessage(InteractiveWindowMessages.DeleteCell);
            this.sendMessage(InteractiveWindowMessages.RemoveCell, { id: cellId });
            this.sendMessage(InteractiveWindowMessages.InsertCell, { cell: newVM.cell, code: '', index: 0, codeCellAboveId: undefined });
        } else {
            // Otherwise delete as normal
            this.deleteCell(cellId);
        }
    }

    public runAbove = (cellId?: string) => {
        const cells = this.getState().cellVMs;
        const index = cellId === Identifiers.EditCellId ? cells.length : cells.findIndex(cvm => cvm.cell.id === cellId);
        if (index > 0) {
            this.suspendUpdates();
            cells.filter((cvm, i) => i < index && cvm.cell.data.cell_type === 'code').
                forEach(cvm => this.submitInput(concatMultilineStringInput(cvm.cell.data.source), cvm));
            this.resumeUpdates();
        }
    }

    public runBelow = (cellId?: string) => {
        const cells = this.getState().cellVMs;
        const index = cells.findIndex(cvm => cvm.cell.id === cellId);
        if (index >= 0) {
            this.suspendUpdates();
            cells.filter((cvm, i) => i >= index && cvm.cell.data.cell_type === 'code').
                forEach(cvm => this.submitInput(concatMultilineStringInput(cvm.cell.data.source), cvm));
            this.resumeUpdates();
        }
    }

    public insertAbove = (cellId?: string, isMonaco?: boolean): string | undefined => {
        const cells = this.getState().cellVMs;
        const index = cellId ? cells.findIndex(cvm => cvm.cell.id === cellId) : 0;
        if (index >= 0) {
            this.suspendUpdates();
            const id = uuid();
            this.setState({ newCell: id });
            const vm = this.insertCell(createEmptyCell(id, null), index, isMonaco);
            this.sendMessage(InteractiveWindowMessages.InsertCell, { cell: vm.cell, index, code: '', codeCellAboveId: this.firstCodeCellAbove(id) });
            this.resumeUpdates();
            return id;
        }
    }

    public insertBelow = (cellId?: string, isMonaco?: boolean): string | undefined => {
        const cells = this.getState().cellVMs;
        const index = cells.findIndex(cvm => cvm.cell.id === cellId);
        if (index >= 0) {
            this.suspendUpdates();
            const id = uuid();
            this.setState({ newCell: id });
            const vm = this.insertCell(createEmptyCell(id, null), index + 1, isMonaco);
            this.sendMessage(InteractiveWindowMessages.InsertCell, { cell: vm.cell, index, code: '', codeCellAboveId: this.firstCodeCellAbove(id) });
            this.resumeUpdates();
            return id;
        }
    }

    public moveCellUp = (cellId?: string) => {
        const origVms = this.getState().cellVMs;
        const cellVms = [...origVms];
        const index = cellVms.findIndex(cvm => cvm.cell.id === cellId);
        if (index > 0) {
            [cellVms[index - 1], cellVms[index]] = [cellVms[index], cellVms[index - 1]];
            this.setState({
                cellVMs: cellVms,
                undoStack: this.pushStack(this.getState().undoStack, origVms)
            });
            this.sendMessage(InteractiveWindowMessages.SwapCells, { firstCellId: cellId!, secondCellId: cellVms[index].cell.id });
        }
    }

    public moveCellDown = (cellId?: string) => {
        const origVms = this.getState().cellVMs;
        const cellVms = [...origVms];
        const index = cellVms.findIndex(cvm => cvm.cell.id === cellId);
        if (index < cellVms.length - 1) {
            [cellVms[index + 1], cellVms[index]] = [cellVms[index], cellVms[index + 1]];
            this.setState({
                cellVMs: cellVms,
                undoStack: this.pushStack(this.getState().undoStack, origVms)
            });
            this.sendMessage(InteractiveWindowMessages.SwapCells, { firstCellId: cellId!, secondCellId: cellVms[index].cell.id });
        }
    }

    public sendCommand(command: NativeCommandType, source: 'keyboard' | 'mouse') {
        this.sendMessage(InteractiveWindowMessages.NativeCommand, { command, source });
    }

    public renderUpdate(newState: {}) {
        super.renderUpdate(newState);

        if (!this.getState().busy && this.waitingForLoadRender) {

            // After this render is complete (see this SO)
            // https://stackoverflow.com/questions/26556436/react-after-render-code,
            // indicate we are done loading. We want to wait for the render
            // so we get accurate timing on first launch.
            setTimeout(() => {
                window.requestAnimationFrame(() => {
                    if (this.waitingForLoadRender) {
                        this.waitingForLoadRender = false;
                        const payload: ILoadAllCells = {
                            cells: this.getState().cellVMs.map(vm => vm.cell)
                        };

                        this.sendMessage(InteractiveWindowMessages.LoadAllCellsComplete, payload);
                    }
                });
            });
        }
    }

    // Adjust the visibility or collapsed state of a cell
    protected alterCellVM(cellVM: ICellViewModel, _visible: boolean, _expanded: boolean): ICellViewModel {
        // cells are always editable
        cellVM.editable = true;

        // Always have the cell input text open
        const newText = extractInputText(cellVM.cell, getSettings());

        cellVM.inputBlockOpen = true;
        cellVM.inputBlockText = newText;

        return cellVM;
    }

    protected onCodeLostFocus(cellId: string) {
        // Update the cell's source
        const index = this.findCellIndex(cellId);
        if (index >= 0) {
            // Get the model source from the monaco editor
            const source = this.getMonacoEditorContents(cellId);
            if (source !== undefined) {
                const newVMs = [...this.getState().cellVMs];

                // Update our state
                newVMs[index] = {
                    ...newVMs[index],
                    inputBlockText: source,
                    cell: {
                        ...newVMs[index].cell,
                        data: {
                            ...newVMs[index].cell.data,
                            source
                        }
                    }
                };

                this.setState({ cellVMs: newVMs });
            }
        }
    }

    /**
     * Custom editor settings for Native editor.
     *
     * @protected
     * @returns
     * @memberof NativeEditorStateController
     */
    protected computeEditorOptions() {
        const options = super.computeEditorOptions();
        options.lineDecorationsWidth = 5;
        return options;
    }
}
