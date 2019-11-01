// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as uuid from 'uuid/v4';

import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { ICell } from '../../../../client/datascience/types';
import {
    createCellVM,
    createEmptyCell,
    CursorPos,
    extractInputText,
    ICellViewModel,
    IMainState
} from '../../../interactive-common/mainState';
import { arePathsSame } from '../../../react-common/arePathsSame';
import { getSettings } from '../../../react-common/settingsReactSide';
import { actionCreators, ICellAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';
import { Helpers } from './helpers';
import { Variables } from './variables';

export namespace Creation {
    function prepareCellVM(cell: ICell): ICellViewModel {
        const cellVM: ICellViewModel = createCellVM(cell, getSettings(), true);

        // Set initial cell visibility and collapse
        cellVM.editable = true;

        // Always have the cell input text open
        const newText = extractInputText(cellVM.cell, getSettings());

        cellVM.inputBlockOpen = true;
        cellVM.inputBlockText = newText;

        return cellVM;
    }

    function updateOrAdd(arg: NativeEditorReducerArg<ICell>): IMainState {
        // First compute new execution count.
        const newExecutionCount = arg.payload.data.execution_count ?
            Math.max(arg.prevState.currentExecutionCount, parseInt(arg.payload.data.execution_count.toString(), 10)) :
            arg.prevState.currentExecutionCount;
        if (newExecutionCount !== arg.prevState.currentExecutionCount && arg.prevState.variablesVisible) {
            // We also need to update our variable explorer when the execution count changes
            // Use the ref here to maintain var explorer independence
            Variables.refreshVariables({ ...arg, payload: { newExecutionCount } });
        }

        const index = arg.prevState.cellVMs.findIndex((c: ICellViewModel) => {
            return c.cell.id === arg.payload.id &&
                c.cell.line === arg.payload.line &&
                arePathsSame(c.cell.file, arg.payload.file);
        });
        if (index >= 0) {
            // This means the cell existed already so it was actual executed code.
            // Use its execution count to update our execution count.

            // Have to make a copy of the cell VM array or
            // we won't actually update.
            const newVMs = [...arg.prevState.cellVMs];

            // Live share has been disabled for now, see https://github.com/microsoft/vscode-python/issues/7972
            // Check to see if our code still matches for the cell (in liveshare it might be updated from the other side)
            // if (concatMultilineStringInput(arg.prevState.cellVMs[index].cell.data.source) !== concatMultilineStringInput(cell.data.source)) {

            // Prevent updates to the source, as its possible we have recieved a response for a cell execution
            // and the user has updated the cell text since then.
            newVMs[index] = {
                ...newVMs[index],
                cell: {
                    ...newVMs[index].cell,
                    state: arg.payload.state,
                    data: {
                        ...arg.payload.data,
                        source: newVMs[index].cell.data.source
                    }
                }
            };

            return {
                ...arg.prevState,
                cellVMs: newVMs,
                currentExecutionCount: newExecutionCount
            };
        } else {
            // This is an entirely new cell (it may have started out as finished)
            const newVM = prepareCellVM(arg.payload);
            const newVMs = [
                ...arg.prevState.cellVMs,
                newVM];
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                currentExecutionCount: newExecutionCount
            };
        }
    }

    export function insertAbove(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVM = prepareCellVM(createEmptyCell(uuid(), null));
        const newList = [...arg.prevState.cellVMs];

        // Find the position where we want to insert
        const position = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (position >= 0) {
            newList.splice(position, 0, newVM);
        } else {
            newList.push(newVM);
        }

        const result = {
            ...arg.prevState,
            cellVMs: newList
        };

        // Queue up an action to set focus to the cell we're inserting
        setTimeout(() => {
            arg.queueAnother(actionCreators.focusCell(newVM.cell.id));
        });

        return result;
    }

    export function insertBelow(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVM = prepareCellVM(createEmptyCell(uuid(), null));
        const newList = [...arg.prevState.cellVMs];

        // Find the position where we want to insert
        const position = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (position >= 0) {
            newList.splice(position + 1, 0, newVM);
        } else {
            newList.push(newVM);
        }

        const result = {
            ...arg.prevState,
            cellVMs: newList
        };

        // Queue up an action to set focus to the cell we're inserting
        setTimeout(() => {
            arg.queueAnother(actionCreators.focusCell(newVM.cell.id));
        });

        return result;
    }

    export function insertAboveFirst(arg: NativeEditorReducerArg): IMainState {
        // Get the first cell id
        const firstCellId = arg.prevState.cellVMs.length > 0 ? arg.prevState.cellVMs[0].cell.id : undefined;

        // Do what an insertAbove does
        return insertAbove({ ...arg, payload: { cellId: firstCellId } });
    }

    export function addNewCell(arg: NativeEditorReducerArg): IMainState {
        // Do the same thing that an insertBelow does using the currently selected cell.
        return insertBelow({ ...arg, payload: { cellId: arg.prevState.selectedCellId } });
    }

    export function startCell(arg: NativeEditorReducerArg<ICell>): IMainState {
        return updateOrAdd(arg);
    }

    export function updateCell(arg: NativeEditorReducerArg<ICell>): IMainState {
        return updateOrAdd(arg);
    }

    export function finishCell(arg: NativeEditorReducerArg<ICell>): IMainState {
        return updateOrAdd(arg);
    }

    export function deleteCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const cells = arg.prevState.cellVMs;
        if (cells.length === 1 && cells[0].cell.id === arg.payload.cellId) {
            // Special case, if this is the last cell, don't delete it, just clear it's output and input
            const newVM: ICellViewModel = {
                cell: createEmptyCell(arg.payload.cellId, null),
                editable: true,
                inputBlockOpen: true,
                inputBlockShow: true,
                inputBlockText: '',
                inputBlockCollapseNeeded: false,
                selected: cells[0].selected,
                focused: cells[0].focused,
                cursorPos: CursorPos.Current
            };

            // Send messages to other side to indicate the new add
            arg.postMessage(InteractiveWindowMessages.DeleteCell);
            arg.postMessage(InteractiveWindowMessages.RemoveCell, { id: arg.payload.cellId });
            arg.postMessage(InteractiveWindowMessages.InsertCell, { cell: newVM.cell, code: '', index: 0, codeCellAboveId: undefined });

            return {
                ...arg.prevState,
                cellVMs: [newVM]
            };
        } else if (arg.payload.cellId) {
            // Otherwise just a straight delete
            const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
            if (index >= 0) {
                arg.postMessage(InteractiveWindowMessages.DeleteCell);
                arg.postMessage(InteractiveWindowMessages.RemoveCell, { id: arg.payload.cellId });

                // Recompute select/focus if this item has either
                let newSelection = arg.prevState.selectedCellId;
                let newFocused = arg.prevState.focusedCellId;
                const newVMs = [...arg.prevState.cellVMs.filter(c => c.cell.id !== arg.payload.cellId)];
                const nextOrPrev = index === arg.prevState.cellVMs.length - 1 ? index - 1 : index;
                if (arg.prevState.selectedCellId === arg.payload.cellId || arg.prevState.focusedCellId === arg.payload.cellId) {
                    if (nextOrPrev >= 0) {
                        newVMs[nextOrPrev] = { ...newVMs[nextOrPrev], selected: true, focused: arg.prevState.focusedCellId === arg.payload.cellId };
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

}
