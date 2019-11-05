// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CursorPos, IMainState } from '../../../interactive-common/mainState';
import { createPostableAction } from '../../../interactive-common/redux/postOffice';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { ICellAction } from '../../../interactive-common/redux/reducers/types';
import { NativeEditorReducerArg } from '../mapping';
import { Effects } from './effects';

export namespace Movement {
    export function moveCellUp(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];
        const index = newVMs.findIndex(cvm => cvm.cell.id === arg.payload.cellId);
        if (index > 0) {
            [newVMs[index - 1], newVMs[index]] = [newVMs[index], newVMs[index - 1]];
            arg.queueAction(createPostableAction(InteractiveWindowMessages.SwapCells, { firstCellId: arg.payload.cellId!, secondCellId: newVMs[index].cell.id }));
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs)
            };
        }

        return arg.prevState;
    }

    export function moveCellDown(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const newVMs = [...arg.prevState.cellVMs];
        const index = newVMs.findIndex(cvm => cvm.cell.id === arg.payload.cellId);
        if (index < newVMs.length - 1) {
            [newVMs[index + 1], newVMs[index]] = [newVMs[index], newVMs[index + 1]];
            arg.queueAction(createPostableAction(InteractiveWindowMessages.SwapCells, { firstCellId: arg.payload.cellId!, secondCellId: newVMs[index].cell.id }));
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs)
            };
        }

        return arg.prevState;
    }

    export function arrowUp(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index > 0) {
            return Effects.selectCell({ ...arg, payload: { cellId: arg.prevState.cellVMs[index - 1].cell.id, cursorPos: CursorPos.Bottom } });
        }

        return arg.prevState;
    }

    export function arrowDown(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
        if (index < arg.prevState.cellVMs.length - 1) {
            return Effects.selectCell({ ...arg, payload: { cellId: arg.prevState.cellVMs[index + 1].cell.id, cursorPos: CursorPos.Bottom } });
        }

        return arg.prevState;
    }
}
