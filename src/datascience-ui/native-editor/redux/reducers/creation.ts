// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { noop } from '../../../../client/common/utils/misc';
import { IEditorContentChange, ILoadAllCells, NotebookModelChange } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { ICell, IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { createCellVM, createEmptyCell, CursorPos, extractInputText, getSelectedAndFocusedInfo, ICellViewModel, IMainState } from '../../../interactive-common/mainState';
import { queueIncomingActionWithPayload } from '../../../interactive-common/redux/helpers';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { CommonActionType, IAddCellAction, ICellAction } from '../../../interactive-common/redux/reducers/types';
import { NativeEditorReducerArg } from '../mapping';
import { Effects } from './effects';
import { Execution } from './execution';
import { Movement } from './movement';

export namespace Creation {
    function prepareCellVM(cell: ICell, hasBeenRun: boolean, settings?: IDataScienceExtraSettings): ICellViewModel {
        const cellVM: ICellViewModel = createCellVM(cell, settings, true, false);

        // Set initial cell visibility and collapse
        cellVM.editable = true;

        // Always have the cell input text open
        const newText = extractInputText(cellVM, settings);

        cellVM.inputBlockOpen = true;
        cellVM.inputBlockText = newText;
        cellVM.hasBeenRun = hasBeenRun;

        return cellVM;
    }

    function findFirstCodeCellAbove(cellVMs: ICellViewModel[], start: number): string | undefined {
        for (let index = start; index >= 0; index -= 1) {
            if (cellVMs[index].cell.data.cell_type === 'code') {
                return cellVMs[index].cell.id;
            }
        }
    }

    export function addAndFocusCell(arg: NativeEditorReducerArg<IAddCellAction>): IMainState {
        queueIncomingActionWithPayload(arg, CommonActionType.ADD_NEW_CELL, { newCellId: arg.payload.data.newCellId });
        queueIncomingActionWithPayload(arg, CommonActionType.FOCUS_CELL, { cellId: arg.payload.data.newCellId, cursorPos: CursorPos.Current });
        return arg.prevState;
    }

    export function insertAboveAndFocusCell(arg: NativeEditorReducerArg<IAddCellAction & ICellAction>): IMainState {
        queueIncomingActionWithPayload(arg, CommonActionType.INSERT_ABOVE, { cellId: arg.payload.data.cellId, newCellId: arg.payload.data.newCellId });
        queueIncomingActionWithPayload(arg, CommonActionType.FOCUS_CELL, { cellId: arg.payload.data.newCellId, cursorPos: CursorPos.Current });
        return arg.prevState;
    }

    export function insertBelowAndFocusCell(arg: NativeEditorReducerArg<IAddCellAction & ICellAction>): IMainState {
        queueIncomingActionWithPayload(arg, CommonActionType.INSERT_BELOW, { cellId: arg.payload.data.cellId, newCellId: arg.payload.data.newCellId });
        queueIncomingActionWithPayload(arg, CommonActionType.FOCUS_CELL, { cellId: arg.payload.data.newCellId, cursorPos: CursorPos.Current });
        return arg.prevState;
    }

    export function insertAboveFirstAndFocusCell(arg: NativeEditorReducerArg<IAddCellAction>): IMainState {
        queueIncomingActionWithPayload(arg, CommonActionType.INSERT_ABOVE_FIRST, { newCellId: arg.payload.data.newCellId });
        queueIncomingActionWithPayload(arg, CommonActionType.FOCUS_CELL, { cellId: arg.payload.data.newCellId, cursorPos: CursorPos.Current });
        return arg.prevState;
    }

    export function insertAbove(arg: NativeEditorReducerArg<ICellAction & IAddCellAction>): IMainState {
        const newVM = prepareCellVM(createEmptyCell(arg.payload.data.newCellId, null), false, arg.prevState.settings);
        const newList = [...arg.prevState.cellVMs];

        // Find the position where we want to insert
        let position = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (position >= 0) {
            newList.splice(position, 0, newVM);
        } else {
            newList.splice(0, 0, newVM);
            position = 0;
        }

        const result = {
            ...arg.prevState,
            undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
            cellVMs: newList
        };

        // Send a messsage that we inserted a cell
        Transfer.postModelInsert(arg, position, newVM.cell, findFirstCodeCellAbove(newList, position));

        return result;
    }

    export function insertBelow(arg: NativeEditorReducerArg<ICellAction & IAddCellAction>): IMainState {
        const newVM = prepareCellVM(createEmptyCell(arg.payload.data.newCellId, null), false, arg.prevState.settings);
        const newList = [...arg.prevState.cellVMs];

        // Find the position where we want to insert
        let position = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (position >= 0) {
            newList.splice(position + 1, 0, newVM);
        } else {
            newList.push(newVM);
            position = newList.length - 2;
        }

        const result = {
            ...arg.prevState,
            undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
            cellVMs: newList
        };

        // Send a messsage that we inserted a cell
        Transfer.postModelInsert(arg, arg.prevState.cellVMs.length, newVM.cell, findFirstCodeCellAbove(newList, position));

        return result;
    }

    export function insertAboveFirst(arg: NativeEditorReducerArg<IAddCellAction>): IMainState {
        // Get the first cell id
        const firstCellId = arg.prevState.cellVMs.length > 0 ? arg.prevState.cellVMs[0].cell.id : undefined;

        // Do what an insertAbove does
        return insertAbove({ ...arg, payload: { ...arg.payload, data: { cellId: firstCellId, newCellId: arg.payload.data.newCellId } } });
    }

    export function addNewCell(arg: NativeEditorReducerArg<IAddCellAction>): IMainState {
        // Do the same thing that an insertBelow does using the currently selected cell.
        return insertBelow({
            ...arg,
            payload: { ...arg.payload, data: { cellId: getSelectedAndFocusedInfo(arg.prevState).selectedCellId, newCellId: arg.payload.data.newCellId } }
        });
    }

    export function startCell(arg: NativeEditorReducerArg<ICell>): IMainState {
        return Helpers.updateOrAdd(arg, (c: ICell, s: IMainState) => prepareCellVM(c, true, s.settings));
    }

    export function updateCell(arg: NativeEditorReducerArg<ICell>): IMainState {
        return Helpers.updateOrAdd(arg, (c: ICell, s: IMainState) => prepareCellVM(c, true, s.settings));
    }

    export function finishCell(arg: NativeEditorReducerArg<ICell>): IMainState {
        return Helpers.updateOrAdd(arg, (c: ICell, s: IMainState) => prepareCellVM(c, true, s.settings));
    }

    export function deleteAllCells(arg: NativeEditorReducerArg<IAddCellAction>): IMainState {
        // Just leave one single blank empty cell
        const newVM: ICellViewModel = {
            cell: createEmptyCell(arg.payload.data.newCellId, null),
            editable: true,
            inputBlockOpen: true,
            inputBlockShow: true,
            inputBlockText: '',
            inputBlockCollapseNeeded: false,
            selected: false,
            focused: false,
            cursorPos: CursorPos.Current,
            hasBeenRun: false,
            scrollCount: 0
        };

        Transfer.postModelRemoveAll(arg, newVM.cell.id);

        return {
            ...arg.prevState,
            cellVMs: [newVM],
            undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs)
        };
    }

    export function applyCellEdit(arg: NativeEditorReducerArg<{ id: string; changes: IEditorContentChange[] }>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.id);
        if (index) {
            const newVM = { ...arg.prevState.cellVMs[index] };
            arg.payload.data.changes.forEach(c => {
                const source = newVM.uncommittedText ? newVM.uncommittedText : newVM.inputBlockText;
                const before = source.slice(0, c.rangeOffset);
                const after = source.slice(c.rangeOffset + c.rangeLength);
                newVM.uncommittedText = `${before}${c.text}${after}`;
            });
            newVM.codeVersion = newVM.codeVersion ? newVM.codeVersion + 1 : 1;
            newVM.inputBlockText = newVM.cell.data.source = newVM.uncommittedText!;
            newVM.cursorPos = arg.payload.data.changes[0].position;
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = Helpers.asCellViewModel(newVM);
            // When editing, make sure we focus the edited cell (otherwise undo looks weird because it undoes a non focused cell)
            return Effects.focusCell({
                ...arg,
                prevState: { ...arg.prevState, cellVMs: newVMs },
                payload: { ...arg.payload, data: { cursorPos: CursorPos.Current, cellId: arg.payload.data.id } }
            });
        }
        return arg.prevState;
    }

    export function deleteCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const cells = arg.prevState.cellVMs;
        if (cells.length === 1 && cells[0].cell.id === arg.payload.data.cellId) {
            // Special case, if this is the last cell, don't delete it, just clear it's output and input
            const newVM: ICellViewModel = {
                cell: createEmptyCell(arg.payload.data.cellId, null),
                editable: true,
                inputBlockOpen: true,
                inputBlockShow: true,
                inputBlockText: '',
                inputBlockCollapseNeeded: false,
                selected: cells[0].selected,
                focused: cells[0].focused,
                cursorPos: CursorPos.Current,
                hasBeenRun: false,
                scrollCount: 0
            };

            // Send messages to other side to indicate the new add
            Transfer.postModelRemove(arg, 0, cells[0].cell);
            Transfer.postModelInsert(arg, 0, newVM.cell);

            return {
                ...arg.prevState,
                undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
                cellVMs: [newVM]
            };
        } else if (arg.payload.data.cellId) {
            // Otherwise just a straight delete
            const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
            if (index >= 0) {
                Transfer.postModelRemove(arg, 0, cells[index].cell);

                // Recompute select/focus if this item has either
                const previousSelection = getSelectedAndFocusedInfo(arg.prevState);
                const newVMs = [...arg.prevState.cellVMs.filter(c => c.cell.id !== arg.payload.data.cellId)];
                const nextOrPrev = index === arg.prevState.cellVMs.length - 1 ? index - 1 : index;
                if (previousSelection.selectedCellId === arg.payload.data.cellId || previousSelection.focusedCellId === arg.payload.data.cellId) {
                    if (nextOrPrev >= 0) {
                        newVMs[nextOrPrev] = { ...newVMs[nextOrPrev], selected: true, focused: previousSelection.focusedCellId === arg.payload.data.cellId };
                    }
                }

                return {
                    ...arg.prevState,
                    cellVMs: newVMs,
                    undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
                    skipNextScroll: true
                };
            }
        }

        return arg.prevState;
    }

    export function loadAllCells(arg: NativeEditorReducerArg<ILoadAllCells>): IMainState {
        const vms = arg.payload.data.cells.map(c => prepareCellVM(c, false, arg.prevState.settings));
        return {
            ...arg.prevState,
            busy: false,
            loadTotal: arg.payload.data.cells.length,
            undoStack: [],
            cellVMs: vms,
            loaded: true
        };
    }

    export function unmount(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            cellVMs: [],
            undoStack: [],
            redoStack: []
        };
    }

    function handleUndoModel(arg: NativeEditorReducerArg<NotebookModelChange>): IMainState {
        // Disable the queueAction in the arg so that calling other reducers doesn't cause
        // messages to be posted back (as were handling a message from the extension here)
        const disabledQueueArg = { ...arg, queueAction: noop };
        switch (arg.payload.data.kind) {
            case 'clear':
                return loadAllCells({ ...disabledQueueArg, payload: { ...arg.payload, data: { cells: arg.payload.data.oldCells } } });
            case 'edit':
                return applyCellEdit({ ...disabledQueueArg, payload: { ...arg.payload, data: { id: arg.payload.data.id, changes: arg.payload.data.reverse } } });
            case 'insert':
                return deleteCell({ ...disabledQueueArg, payload: { ...arg.payload, data: { cellId: arg.payload.data.cell.id } } });
            case 'remove':
                const cellBelow = arg.prevState.cellVMs.length > arg.payload.data.index ? arg.prevState.cellVMs[arg.payload.data.index].cell : undefined;
                return insertAbove({
                    ...disabledQueueArg,
                    payload: { ...arg.payload, data: { newCellId: arg.payload.data.cell.id, cellId: cellBelow ? cellBelow.id : undefined } }
                });
            case 'remove_all':
                return loadAllCells({ ...disabledQueueArg, payload: { ...arg.payload, data: { cells: arg.payload.data.oldCells } } });
            case 'swap':
                return Movement.swapCells({
                    ...disabledQueueArg,
                    payload: { ...arg.payload, data: { firstCellId: arg.payload.data.secondCellId, secondCellId: arg.payload.data.firstCellId } }
                });
            case 'modify':
                // Undo for modify should reapply the outputs. Go through each and apply the update
                let result = arg.prevState;
                arg.payload.data.oldCells.forEach(c => {
                    result = updateCell({ ...disabledQueueArg, prevState: result, payload: { ...arg.payload, data: c } });
                });
                return result;

            default:
                // File, version can be ignored.
                break;
        }

        return arg.prevState;
    }

    function handleRedoModel(arg: NativeEditorReducerArg<NotebookModelChange>): IMainState {
        // Disable the queueAction in the arg so that calling other reducers doesn't cause
        // messages to be posted back (as were handling a message from the extension here)
        const disabledQueueArg = { ...arg, queueAction: noop };
        switch (arg.payload.data.kind) {
            case 'clear':
                // tslint:disable-next-line: no-any
                return Execution.clearAllOutputs(disabledQueueArg as any);
            case 'edit':
                return applyCellEdit({ ...disabledQueueArg, payload: { ...arg.payload, data: { id: arg.payload.data.id, changes: arg.payload.data.forward } } });
            case 'insert':
                return insertAbove({ ...disabledQueueArg, payload: { ...arg.payload, data: { newCellId: arg.payload.data.cell.id, cellId: arg.payload.data.codeCellAboveId } } });
            case 'remove':
                return deleteCell({ ...disabledQueueArg, payload: { ...arg.payload, data: { cellId: arg.payload.data.cell.id } } });
            case 'remove_all':
                return deleteAllCells({ ...disabledQueueArg, payload: { ...arg.payload, data: { newCellId: arg.payload.data.newCellId } } });
            case 'swap':
                return Movement.swapCells({
                    ...disabledQueueArg,
                    payload: { ...arg.payload, data: { firstCellId: arg.payload.data.secondCellId, secondCellId: arg.payload.data.firstCellId } }
                });
            case 'modify':
                // Redo for modify should reapply the outputs. Go through each and apply the update
                let result = arg.prevState;
                arg.payload.data.newCells.forEach(c => {
                    result = updateCell({ ...disabledQueueArg, prevState: result, payload: { ...arg.payload, data: c } });
                });
                return result;
            default:
                // Modify, file, version can all be ignored.
                break;
        }

        return arg.prevState;
    }

    export function handleUpdate(arg: NativeEditorReducerArg<NotebookModelChange>): IMainState {
        switch (arg.payload.data.source) {
            case 'undo':
                return handleUndoModel(arg);
            case 'redo':
                return handleRedoModel(arg);
            default:
                break;
        }
        return arg.prevState;
    }
}
