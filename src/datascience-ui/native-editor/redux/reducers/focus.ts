// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IMainState } from '../../../interactive-common/mainState';
import { ICellAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';

export namespace Focus {
    export function focusCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Focus one cell and unfocus another. Focus should always gain selection too.
        const addFocusIndex = newVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        let removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.focusedCellId);
        if (removeFocusIndex < 0) {
            removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        }
        if (addFocusIndex >= 0) {
            newVMs[addFocusIndex] = { ...newVMs[addFocusIndex], focused: true, selected: true };
        }
        if (removeFocusIndex >= 0) {
            newVMs[removeFocusIndex] = { ...newVMs[removeFocusIndex], focused: false, selected: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: arg.payload.cellId,
            selectedCellId: arg.payload.cellId
        };
    }

    export function unfocusCell(arg: NativeEditorReducerArg): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Unfocus the currently focused cell.
        const removeFocusIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.focusedCellId);
        if (removeFocusIndex >= 0) {
            newVMs[removeFocusIndex] = { ...newVMs[removeFocusIndex], focused: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: undefined
        };
    }

    export function selectCell(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];

        // Select one cell and unselect another.
        const addIndex = newVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        const removeIndex = newVMs.findIndex(c => c.cell.id === arg.prevState.selectedCellId);
        if (addIndex >= 0) {
            newVMs[addIndex] = {
                ...newVMs[addIndex],
                focused: arg.prevState.focusedCellId !== undefined && arg.prevState.focusedCellId === arg.prevState.selectedCellId,
                selected: true
            };
        }
        if (removeIndex >= 0) {
            newVMs[removeIndex] = { ...newVMs[removeIndex], focused: false, selected: false };
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            focusedCellId: arg.prevState.focusedCellId !== undefined ? arg.payload.cellId : undefined,
            selectedCellId: arg.payload.cellId
        };
    }
}
