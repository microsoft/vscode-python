// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ILoadAllCells, InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { ICell, IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { createCellVM, createEmptyCell, CursorPos, extractInputText, ICellViewModel, IMainState } from '../../../interactive-common/mainState';
import { createPostableAction } from '../../../interactive-common/redux/postOffice';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { IAddCellAction, ICellAction } from '../../../interactive-common/redux/reducers/types';
import { actionCreators } from '../actions';
import { NativeEditorReducerArg } from '../mapping';

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
        arg.queueAction(
            createPostableAction(InteractiveWindowMessages.InsertCell, { cell: newVM.cell, index: position, code: '', codeCellAboveId: findFirstCodeCellAbove(newList, position) })
        );

        // Queue up an action to set focus to the cell we're inserting
        setTimeout(() => {
            arg.queueAction(actionCreators.focusCell(newVM.cell.id));
        });

        return result;
    }

    export function insertBelow(arg: NativeEditorReducerArg<ICellAction & IAddCellAction>): IMainState {
        const newVM = prepareCellVM(createEmptyCell(arg.payload.data.newCellId, null), false, arg.prevState.settings);
        const newList = [...arg.prevState.cellVMs];

        // Find the position where we want to insert
        let position = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        let index = 0;
        if (position >= 0) {
            newList.splice(position + 1, 0, newVM);
            index = position + 1;
        } else {
            newList.push(newVM);
            position = newList.length - 2;
            index = newList.length - 1;
        }

        const result = {
            ...arg.prevState,
            undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
            cellVMs: newList
        };

        // Send a messsage that we inserted a cell
        arg.queueAction(
            createPostableAction(InteractiveWindowMessages.InsertCell, { cell: newVM.cell, index, code: '', codeCellAboveId: findFirstCodeCellAbove(newList, position) })
        );

        // Queue up an action to set focus to the cell we're inserting
        setTimeout(() => {
            arg.queueAction(actionCreators.focusCell(newVM.cell.id));
        });

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
        return insertBelow({ ...arg, payload: { ...arg.payload, data: { cellId: arg.prevState.selectedCellId, newCellId: arg.payload.data.newCellId } } });
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
        // Send messages to other side to indicate the deletes
        arg.queueAction(createPostableAction(InteractiveWindowMessages.DeleteAllCells));

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

        arg.queueAction(createPostableAction(InteractiveWindowMessages.InsertCell, { cell: newVM.cell, code: '', index: 0, codeCellAboveId: undefined }));

        return {
            ...arg.prevState,
            cellVMs: [newVM],
            undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
            selectedCellId: undefined,
            focusedCellId: undefined
        };
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
            arg.queueAction(createPostableAction(InteractiveWindowMessages.DeleteCell));
            arg.queueAction(createPostableAction(InteractiveWindowMessages.RemoveCell, { id: arg.payload.data.cellId }));
            arg.queueAction(createPostableAction(InteractiveWindowMessages.InsertCell, { cell: newVM.cell, code: '', index: 0, codeCellAboveId: undefined }));

            return {
                ...arg.prevState,
                undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs),
                cellVMs: [newVM]
            };
        } else if (arg.payload.data.cellId) {
            // Otherwise just a straight delete
            const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
            if (index >= 0) {
                arg.queueAction(createPostableAction(InteractiveWindowMessages.DeleteCell));
                arg.queueAction(createPostableAction(InteractiveWindowMessages.RemoveCell, { id: arg.payload.data.cellId }));

                // Recompute select/focus if this item has either
                let newSelection = arg.prevState.selectedCellId;
                let newFocused = arg.prevState.focusedCellId;
                const newVMs = [...arg.prevState.cellVMs.filter(c => c.cell.id !== arg.payload.data.cellId)];
                const nextOrPrev = index === arg.prevState.cellVMs.length - 1 ? index - 1 : index;
                if (arg.prevState.selectedCellId === arg.payload.data.cellId || arg.prevState.focusedCellId === arg.payload.data.cellId) {
                    if (nextOrPrev >= 0) {
                        newVMs[nextOrPrev] = { ...newVMs[nextOrPrev], selected: true, focused: arg.prevState.focusedCellId === arg.payload.data.cellId };
                        newSelection = newVMs[nextOrPrev].cell.id;
                        newFocused = newVMs[nextOrPrev].focused ? newVMs[nextOrPrev].cell.id : undefined;
                    }
                }

                return {
                    ...arg.prevState,
                    cellVMs: newVMs,
                    selectedCellId: newSelection,
                    focusedCellId: newFocused,
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
}
