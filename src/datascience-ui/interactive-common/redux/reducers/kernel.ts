// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState } from '../../../../client/datascience/types';
import { IMainState, IServerState } from '../../mainState';
import { createPostableAction } from '../helpers';
import { CommonActionType, CommonReducerArg } from './types';

export namespace Kernel {
    // tslint:disable-next-line: no-any
    export function selectKernel(arg: CommonReducerArg<CommonActionType | InteractiveWindowMessages, IServerState | undefined>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SelectKernel));

        return arg.prevState;
    }
    export function selectJupyterURI(arg: CommonReducerArg): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SelectJupyterServer));

        return arg.prevState;
    }
    export function restartKernel(arg: CommonReducerArg): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.RestartKernel));

        // Set busy until kernel is restarted
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function interruptKernel(arg: CommonReducerArg): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Interrupt));

        // Set busy until kernel is finished interrupting
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function updateStatus(arg: CommonReducerArg<CommonActionType | InteractiveWindowMessages, IServerState | undefined>): IMainState {
        if (arg.payload.data) {
            return {
                ...arg.prevState,
                kernel: {
                    localizedUri: arg.payload.data.localizedUri,
                    jupyterServerStatus: arg.payload.data.jupyterServerStatus,
                    displayName: arg.payload.data.displayName
                }
            };
        }
        return arg.prevState;
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
