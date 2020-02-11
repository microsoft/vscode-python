// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Reducer } from 'redux';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    ICell,
    IJupyterVariable,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse
} from '../../../../client/datascience/types';
import { combineReducers, QueuableAction, ReducerArg, ReducerFunc } from '../../../react-common/reduxUtils';
import { createPostableAction, IncomingMessageActions } from '../postOffice';
import { CommonActionType } from './types';

export type IVariableState = {
    currentExecutionCount: number;
    visible: boolean;
    sortColumn: string;
    sortAscending: boolean;
    variables: IJupyterVariable[];
    pageSize: number;
};

type VariableReducerFunc<T> = ReducerFunc<IVariableState, IncomingMessageActions, T>;

type VariableReducerArg<T = never | undefined> = ReducerArg<IVariableState, IncomingMessageActions, T>;

function handleRequest(arg: VariableReducerArg<IJupyterVariablesRequest>): IVariableState {
    const newExecutionCount =
        arg.payload.executionCount !== undefined ? arg.payload.executionCount : arg.prevState.currentExecutionCount;
    arg.queueAction(
        createPostableAction(InteractiveWindowMessages.GetVariablesRequest, {
            executionCount: newExecutionCount,
            sortColumn: arg.payload.sortColumn,
            startIndex: arg.payload.startIndex,
            sortAscending: arg.payload.sortAscending,
            pageSize: arg.payload.pageSize
        })
    );
    return {
        ...arg.prevState,
        pageSize: Math.max(arg.prevState.pageSize, arg.payload.pageSize)
    };
}

function toggleVariableExplorer(arg: VariableReducerArg): IVariableState {
    const newState: IVariableState = {
        ...arg.prevState,
        visible: !arg.prevState.visible
    };

    arg.queueAction(createPostableAction(InteractiveWindowMessages.VariableExplorerToggle, newState.visible));

    // If going visible for the first time, refresh our variables
    if (newState.visible) {
        return handleRequest({
            ...arg,
            prevState: newState,
            payload: {
                executionCount: arg.prevState.currentExecutionCount,
                sortColumn: 'name',
                sortAscending: true,
                startIndex: 0,
                pageSize: arg.prevState.pageSize
            }
        });
    } else {
        return newState;
    }
}

function handleResponse(arg: VariableReducerArg<IJupyterVariablesResponse>): IVariableState {
    const response = arg.payload;

    // Check to see if we have moved to a new execution count
    if (
        response.executionCount > arg.prevState.currentExecutionCount ||
        (response.executionCount === arg.prevState.currentExecutionCount && arg.prevState.variables.length === 0)
    ) {
        // Should be an entirely new request. Make an empty list
        const variables = Array<IJupyterVariable>(response.totalCount);

        // Replace the page with the values returned
        for (let i = 0; i < response.pageResponse.length; i += 1) {
            variables[i + response.pageStartIndex] = response.pageResponse[i];
        }

        // Also update the execution count.
        return {
            ...arg.prevState,
            currentExecutionCount: response.executionCount,
            variables
        };
    } else if (response.executionCount === arg.prevState.currentExecutionCount) {
        // This is a response for a page in an already existing list.
        const variables = [...arg.prevState.variables];

        // See if we need to remove any from this page
        const removeCount = Math.max(0, arg.prevState.variables.length - response.totalCount);
        if (removeCount) {
            variables.splice(response.pageStartIndex, removeCount);
        }

        // Replace the page with the values returned
        for (let i = 0; i < response.pageResponse.length; i += 1) {
            variables[i + response.pageStartIndex] = response.pageResponse[i];
        }

        return {
            ...arg.prevState,
            variables
        };
    }

    // Otherwise this response is for an old execution.
    return arg.prevState;
}

function handleRestarted(arg: VariableReducerArg): IVariableState {
    // If the variables are visible, refresh them
    if (arg.prevState.visible) {
        const result = handleRequest({
            ...arg,
            payload: {
                executionCount: 0,
                sortColumn: 'name',
                sortAscending: true,
                startIndex: 0,
                pageSize: arg.prevState.pageSize
            }
        });
        return {
            ...result,
            currentExecutionCount: 0,
            variables: []
        };
    }
    return arg.prevState;
}

function handleFinishCell(arg: VariableReducerArg<ICell>): IVariableState {
    const executionCount = arg.payload.data.execution_count
        ? parseInt(arg.payload.data.execution_count.toString(), 10)
        : undefined;

    // If the variables are visible, refresh them
    if (arg.prevState.visible && executionCount) {
        return handleRequest({
            ...arg,
            payload: {
                executionCount,
                sortColumn: 'name',
                sortAscending: true,
                startIndex: 0,
                pageSize: arg.prevState.pageSize
            }
        });
    }
    return {
        ...arg.prevState,
        currentExecutionCount: executionCount ? executionCount : arg.prevState.currentExecutionCount
    };
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
        sortColumn: 'name',
        pageSize: 5
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IVariableState, IVariableActionMapping>(defaultState, reducerMap);
}
