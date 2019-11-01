// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { CellMatcher } from '../../../../client/datascience/cellMatcher';
import { concatMultilineStringInput } from '../../../../client/datascience/common';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState, ICell } from '../../../../client/datascience/types';
import { IMainState } from '../../../interactive-common/mainState';
import { getSettings } from '../../../react-common/settingsReactSide';
import { IExecuteAction, IExecuteAllAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';

export namespace Execution {
    function modifyStateForCellExecute(prevState: IMainState, index: number, code: string | undefined): IMainState {
        if (index >= 0 && index < prevState.cellVMs.length) {
            const vm = prevState.cellVMs[index];
            // noop if the submitted code is just a cell marker
            const matcher = new CellMatcher(getSettings());
            if (code && matcher.stripFirstMarker(code).length > 0) {
                const newVMs = [...prevState.cellVMs];

                if (vm.cell.data.cell_type === 'code') {
                    // Update our input cell to be in progress again and clear outputs
                    newVMs[index] = { ...vm, inputBlockText: code, cell: { ...vm.cell, state: CellState.executing, data: { ...vm.cell.data, source: code, outputs: [] } } };
                } else {
                    // Update our input to be our new code
                    newVMs[index] = { ...vm, inputBlockText: code, cell: { ...vm.cell, data: { ...vm.cell.data, source: code } } };
                }
                return {
                    ...prevState,
                    cellVMs: newVMs
                };
            }
        }

        return prevState;
    }

    export function executeCell(arg: NativeEditorReducerArg<IExecuteAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);

        // Generate a new state based on the cell type.
        const newState = modifyStateForCellExecute(arg.prevState, index, arg.payload.code);

        // Post a message to the other side to reexecute
        if (arg.payload.cellId && arg.payload.code) {
            arg.postMessage(InteractiveWindowMessages.ReExecuteCell, { code: arg.payload.code, id: arg.payload.cellId });
        }

        return newState;
    }

    export function executeAllCells(arg: NativeEditorReducerArg<IExecuteAllAction>): IMainState {
        // Go through all cells and reexecute them. We only want a single state update though.
        if (arg.payload.codes && arg.payload.codes.length) {
            const result = arg.payload.codes.reduce<IMainState>((p, c, i) => modifyStateForCellExecute(p, i, c), arg.prevState);

            // However we want to send a message for each
            result.cellVMs.filter(c => c.cell.data.cell_type === 'code').forEach(
                vm => arg.postMessage(
                    InteractiveWindowMessages.ReExecuteCell,
                    { code: concatMultilineStringInput(vm.cell.data.source), id: vm.cell.id }));

            return result;
        }

        return arg.prevState;
    }

    export function clearAllOutputs(arg: NativeEditorReducerArg): IMainState {
        const newList = arg.prevState.cellVMs.map(cellVM => {
            return { ...cellVM, cell: { ...cellVM.cell, data: { ...cellVM.cell.data, outputs: [], execution_count: null } } };
        });
        return {
            ...arg.prevState,
            cellVMs: newList
        };
    }
}
