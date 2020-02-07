// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CursorPos, IMainState } from '../../../interactive-common/mainState';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { ICellAction, ICodeAction } from '../../../interactive-common/redux/reducers/types';
import { NativeEditorReducerArg } from '../mapping';
import { Effects } from './effects';

export namespace Movement {
    export function swapCells(arg: NativeEditorReducerArg<{ firstCellId: string; secondCellId: string }>) {
        const newVMs = [...arg.prevState.cellVMs];
        const first = newVMs.findIndex(cvm => cvm.cell.id === arg.payload.data.firstCellId);
        const second = newVMs.findIndex(cvm => cvm.cell.id === arg.payload.data.secondCellId);
        if (first >= 0 && second >= 0 && first !== second) {
            const temp = newVMs[first];
            newVMs[first] = newVMs[second];
            newVMs[second] = temp;
            Transfer.postModelSwap(arg, arg.payload.data.firstCellId, arg.payload.data.secondCellId);
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs)
            };
        }

        return arg.prevState;
    }

    export function moveCellUp(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(cvm => cvm.cell.id === arg.payload.data.cellId);
        if (index > 0 && arg.payload.data.cellId) {
            return swapCells({ ...arg, payload: { ...arg.payload, data: { firstCellId: arg.prevState.cellVMs[index - 1].cell.id, secondCellId: arg.payload.data.cellId } } });
        }

        return arg.prevState;
    }

    export function moveCellDown(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];
        const index = newVMs.findIndex(cvm => cvm.cell.id === arg.payload.data.cellId);
        if (index < newVMs.length - 1 && arg.payload.data.cellId) {
            return swapCells({ ...arg, payload: { ...arg.payload, data: { firstCellId: arg.payload.data.cellId, secondCellId: arg.prevState.cellVMs[index + 1].cell.id } } });
        }

        return arg.prevState;
    }

    export function arrowUp(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index > 0) {
            const newState = Effects.selectCell({ ...arg, payload: { ...arg.payload, data: { cellId: arg.prevState.cellVMs[index - 1].cell.id, cursorPos: CursorPos.Bottom } } });
            const newVMs = [...newState.cellVMs];
            newVMs[index] = Helpers.asCellViewModel({
                ...newVMs[index],
                inputBlockText: arg.payload.data.code,
                cell: { ...newVMs[index].cell, data: { ...newVMs[index].cell.data, source: arg.payload.data.code } }
            });
            return {
                ...newState,
                cellVMs: newVMs
            };
        }

        return arg.prevState;
    }

    export function arrowDown(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index < arg.prevState.cellVMs.length - 1) {
            const newState = Effects.selectCell({ ...arg, payload: { ...arg.payload, data: { cellId: arg.prevState.cellVMs[index + 1].cell.id, cursorPos: CursorPos.Top } } });
            const newVMs = [...newState.cellVMs];
            newVMs[index] = Helpers.asCellViewModel({
                ...newVMs[index],
                inputBlockText: arg.payload.data.code,
                cell: { ...newVMs[index].cell, data: { ...newVMs[index].cell.data, source: arg.payload.data.code } }
            });
            return {
                ...newState,
                cellVMs: newVMs
            };
        }

        return arg.prevState;
    }
}
