// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState } from '../../../../client/datascience/types';
import { IMainState, IServerState } from '../../mainState';
import { createPostableAction } from '../postOffice';
import { CommonReducerArg } from './types';

export namespace Kernel {
    export function selectKernel<T>(arg: CommonReducerArg<T>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SelectKernel));

        return arg.prevState;
    }
    export function selectJupyterURI<T>(arg: CommonReducerArg<T>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SelectJupyterServer));

        return arg.prevState;
    }
    export function restartKernel<T>(arg: CommonReducerArg<T>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.RestartKernel));

        // Set busy until kernel is restarted
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function interruptKernel<T>(arg: CommonReducerArg<T>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Interrupt));

        // Set busy until kernel is finished interrupting
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function updateStatus<T>(arg: CommonReducerArg<T, IServerState>): IMainState {
        return {
            ...arg.prevState,
            kernel: {
                localizedUri: arg.payload.localizedUri,
                jupyterServerStatus: arg.payload.jupyterServerStatus,
                displayName: arg.payload.displayName
            }
        };
    }

    export function handleRestarted<T>(arg: CommonReducerArg<T>) {
        // When we restart, make sure to turn off all executing cells. They aren't executing anymore
        const newVMs = [...arg.prevState.cellVMs];
        newVMs.forEach((vm, i) => {
            if (vm.cell.state !== CellState.finished && vm.cell.state !== CellState.error) {
                newVMs[i] = { ...vm, hasBeenRun: false, cell: { ...vm.cell, state: CellState.finished } };
            }
        });

        return {
            ...arg.prevState,
            cellVMs: newVMs,
            pendingVariableCount: 0,
            variables: [],
            currentExecutionCount: 0
        };
    }
}
