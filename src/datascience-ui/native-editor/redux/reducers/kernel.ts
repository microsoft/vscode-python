// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../../interactive-common/mainState';
import { NativeEditorReducerArg } from '../mapping';
import { CellState } from '../../../../client/datascience/types';

export namespace Kernel {
    export function restartKernel(arg: NativeEditorReducerArg): IMainState {
        arg.postMessage(InteractiveWindowMessages.RestartKernel);

        // Doesn't modify anything right now. Might set a busy flag or kernel state in the future
        return arg.prevState;
    }

    export function interruptKernel(arg: NativeEditorReducerArg): IMainState {
        arg.postMessage(InteractiveWindowMessages.Interrupt);

        // Doesn't modify anything right now. Might set a busy flag or kernel state in the future
        return arg.prevState;
    }

    export function handleRestarted(arg: NativeEditorReducerArg) {
        // When we restart, make sure to turn off all executing cells. They aren't executing anymore
        const newVMs = [...arg.prevState.cellVMs];
        newVMs.forEach((vm, i) => {
            if (vm.cell.state !== CellState.finished && vm.cell.state !== CellState.error) {
                newVMs[i] = { ...vm, cell: { ...vm.cell, state: CellState.finished } };
            }
        });

        // Update our variables
        arg.postMessage(InteractiveWindowMessages.GetVariablesRequest);

        return {
            ...arg.prevState,
            cellVMs: newVMs,
            currentExecutionCount: 0
        };
    }
}
