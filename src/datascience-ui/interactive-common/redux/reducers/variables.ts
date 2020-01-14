// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Reducer } from 'react';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { ICell, IJupyterVariable, IJupyterVariablesRequest, IJupyterVariablesResponse } from '../../../../client/datascience/types';
import { combineReducers, QueuableAction, ReducerArg, ReducerFunc } from '../../../react-common/reduxUtils';
import { createPostableAction, IncomingMessageActions } from '../postOffice';
import { CommonActionType } from './types';

export type IVariableState = {
    currentExecutionCount: number;
    visible: boolean;
    sortColumn: string;
    sortAscending: boolean;
    variables: IJupyterVariable[];
};

type VariableReducerFunc<T> = ReducerFunc<IVariableState, IncomingMessageActions, T>;

type VariableReducerArg<T = never | undefined> = ReducerArg<IVariableState, IncomingMessageActions, T>;

function handleRequest(arg: VariableReducerArg<IJupyterVariablesRequest>): IVariableState {
    arg.queueAction(
        createPostableAction(InteractiveWindowMessages.GetVariablesRequest, {
            executionCount: arg.payload.executionCount ? arg.prevState.currentExecutionCount : arg.payload.executionCount,
            sortColumn: arg.payload.sortColumn,
            startIndex: arg.payload.startIndex,
            sortAscending: arg.payload.sortAscending,
            pageSize: arg.payload.pageSize
        })
    );
    return arg.prevState;
}

function toggleVariableExplorer(arg: VariableReducerArg): IVariableState {
    const newState: IVariableState = {
        ...arg.prevState,
        visible: !arg.prevState.visible
    };

    arg.queueAction(createPostableAction(InteractiveWindowMessages.VariableExplorerToggle, newState.visible));

    // If going visible for the first time, refresh our variables
    if (newState.visible) {
        return handleRestarted({ ...arg, prevState: newState });
    } else {
        return newState;
    }
}

function handleResponse(arg: VariableReducerArg<IJupyterVariablesResponse>): IVariableState {
    const variablesResponse = arg.payload as IJupyterVariablesResponse;

    // Check to see if we have moved to a new execution count only send our update if we are on the same count as the request
    if (variablesResponse.executionCount === arg.prevState.currentExecutionCount) {
        return {
            ...arg.prevState,
            variables: variablesResponse.variables
        };
    }

    return arg.prevState;
}

function handleRestarted(arg: VariableReducerArg): IVariableState {
    // If the variables are visible, refresh them
    if (arg.prevState.visible) {
        return handleRequest({ ...arg, payload: { executionCount: 0, sortColumn: 'name', sortAscending: true, startIndex: 0, pageSize: 100 } });
    }
    return arg.prevState;
}

function handleFinishCell(arg: VariableReducerArg<ICell>): IVariableState {
    // If the variables are visible, refresh them
    if (arg.prevState.visible && arg.payload.data.execution_count) {
        const executionCount = parseInt(arg.payload.data.execution_count.toString(), 10);
        return handleRequest({ ...arg, payload: { executionCount, sortColumn: 'name', sortAscending: true, startIndex: 0, pageSize: 100 } });
    }
    return arg.prevState;
}

// Create a mapping between message and reducer type
class IVariableActionMapping {
    public [IncomingMessageActions.RESTARTKERNEL]: VariableReducerFunc<never | undefined>;
    public [IncomingMessageActions.FINISHCELL]: VariableReducerFunc<ICell>;
    public [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: VariableReducerFunc<never | undefined>;
    public [CommonActionType.GET_VARIABLE_DATA]: VariableReducerFunc<IJupyterVariablesRequest>;
    public [IncomingMessageActions.GETVARIABLESRESPONSE]: VariableReducerFunc<IJupyterVariablesResponse>;
}

// Create the map between message type and the actual function to call to update state
const reducerMap: IVariableActionMapping = {
    [IncomingMessageActions.RESTARTKERNEL]: handleRestarted,
    [IncomingMessageActions.FINISHCELL]: handleFinishCell,
    [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: toggleVariableExplorer,
    [CommonActionType.GET_VARIABLE_DATA]: handleRequest,
    [IncomingMessageActions.GETVARIABLESRESPONSE]: handleResponse
};

export function generateVariableReducer(): Reducer<IVariableState, QueuableAction<IVariableActionMapping>> {
    // First create our default state.
    const defaultState: IVariableState = {
        currentExecutionCount: 0,
        variables: [],
        visible: false,
        sortAscending: true,
        sortColumn: 'name'
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IVariableState, IVariableActionMapping>(defaultState, reducerMap);
}
