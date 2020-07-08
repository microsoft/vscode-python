// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Reducer } from 'redux';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../../client/datascience/interactive-common/types';
import {
    ICell,
    IJupyterVariable,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse
} from '../../../../client/datascience/types';
import { combineReducers, QueuableAction, ReducerArg, ReducerFunc } from '../../../react-common/reduxUtils';
import { postActionToExtension } from '../helpers';
import { CommonActionType, CommonActionTypeMapping, ICellAction, IVariableExplorerHeight } from './types';

export type IVariableState = {
    currentExecutionCount: number;
    visible: boolean;
    sortColumn: string;
    sortAscending: boolean;
    variables: IJupyterVariable[];
    pageSize: number;
    containerHeight: number;
    gridHeight: number;
    refreshCount: number;
    showVariablesOnDebug: boolean;
};

type VariableReducerFunc<T = never | undefined> = ReducerFunc<
    IVariableState,
    InteractiveWindowMessages,
    BaseReduxActionPayload<T>
>;
type VariableReducerArg<T = never | undefined> = ReducerArg<
    IVariableState,
    InteractiveWindowMessages,
    BaseReduxActionPayload<T>
>;

function handleRequest(arg: VariableReducerArg<IJupyterVariablesRequest>): IVariableState {
    const newExecutionCount =
        arg.payload.data.executionCount !== undefined
            ? arg.payload.data.executionCount
            : arg.prevState.currentExecutionCount;
    postActionToExtension(arg, InteractiveWindowMessages.GetVariablesRequest, {
        executionCount: newExecutionCount,
        sortColumn: arg.payload.data.sortColumn,
        startIndex: arg.payload.data.startIndex,
        sortAscending: arg.payload.data.sortAscending,
        pageSize: arg.payload.data.pageSize,
        refreshCount: arg.payload.data.refreshCount
    });
    return {
        ...arg.prevState,
        pageSize: Math.max(arg.prevState.pageSize, arg.payload.data.pageSize)
    };
}

function toggleVariableExplorer(arg: VariableReducerArg): IVariableState {
    const newState: IVariableState = {
        ...arg.prevState,
        visible: !arg.prevState.visible,
        showVariablesOnDebug: false // If user does any toggling don't auto open this.
    };

    postActionToExtension(arg, InteractiveWindowMessages.VariableExplorerToggle, newState.visible);

    // If going visible for the first time, refresh our variables
    if (newState.visible) {
        return handleRequest({
            ...arg,
            prevState: newState,
            payload: {
                ...arg.payload,
                data: {
                    executionCount: arg.prevState.currentExecutionCount,
                    sortColumn: 'name',
                    sortAscending: true,
                    startIndex: 0,
                    pageSize: arg.prevState.pageSize,
                    refreshCount: arg.prevState.refreshCount
                }
            }
        });
    } else {
        return newState;
    }
}

function handleVariableExplorerHeightResponse(arg: VariableReducerArg<IVariableExplorerHeight>): IVariableState {
    if (arg.payload.data) {
        const containerHeight = arg.payload.data.containerHeight;
        const gridHeight = arg.payload.data.gridHeight;
        if (containerHeight && gridHeight) {
            return {
                ...arg.prevState,
                containerHeight: containerHeight,
                gridHeight: gridHeight
            };
        }
    }
    return {
        ...arg.prevState
    };
}

function setVariableExplorerHeight(arg: VariableReducerArg<IVariableExplorerHeight>): IVariableState {
    const containerHeight = arg.payload.data.containerHeight;
    const gridHeight = arg.payload.data.gridHeight;

    if (containerHeight && gridHeight) {
        postActionToExtension(arg, InteractiveWindowMessages.SetVariableExplorerHeight, {
            containerHeight,
            gridHeight
        });
        return {
            ...arg.prevState,
            containerHeight: containerHeight,
            gridHeight: gridHeight
        };
    }
    return {
        ...arg.prevState
    };
}

function handleResponse(arg: VariableReducerArg<IJupyterVariablesResponse>): IVariableState {
    const response = arg.payload.data;

    // Check to see if we have moved to a new execution count
    if (
        response.executionCount > arg.prevState.currentExecutionCount ||
        response.refreshCount > arg.prevState.refreshCount ||
        (response.executionCount === arg.prevState.currentExecutionCount && arg.prevState.variables.length === 0) ||
        (response.refreshCount === arg.prevState.refreshCount && arg.prevState.variables.length === 0)
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
            refreshCount: response.refreshCount,
            variables
        };
    } else if (
        response.executionCount === arg.prevState.currentExecutionCount &&
        response.refreshCount === arg.prevState.refreshCount
    ) {
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
    const result = handleRequest({
        ...arg,
        payload: {
            ...arg.payload,
            data: {
                executionCount: 0,
                sortColumn: 'name',
                sortAscending: true,
                startIndex: 0,
                pageSize: arg.prevState.pageSize,
                refreshCount: 0
            }
        }
    });
    return {
        ...result,
        currentExecutionCount: -1,
        variables: []
    };
}

function handleFinishCell(arg: VariableReducerArg<ICell>): IVariableState {
    const executionCount = arg.payload.data.data.execution_count
        ? parseInt(arg.payload.data.data.execution_count.toString(), 10)
        : undefined;

    // If the variables are visible, refresh them
    if (arg.prevState.visible && executionCount) {
        return handleRequest({
            ...arg,
            payload: {
                ...arg.payload,
                data: {
                    executionCount,
                    sortColumn: 'name',
                    sortAscending: true,
                    startIndex: 0,
                    pageSize: arg.prevState.pageSize,
                    refreshCount: arg.prevState.refreshCount
                }
            }
        });
    }
    return {
        ...arg.prevState,
        currentExecutionCount: executionCount ? executionCount : arg.prevState.currentExecutionCount
    };
}

function handleRefresh(arg: VariableReducerArg): IVariableState {
    // If the variables are visible, refresh them
    if (arg.prevState.visible) {
        return handleRequest({
            ...arg,
            payload: {
                ...arg.payload,
                data: {
                    executionCount: arg.prevState.currentExecutionCount,
                    sortColumn: 'name',
                    sortAscending: true,
                    startIndex: 0,
                    pageSize: arg.prevState.pageSize,
                    refreshCount: arg.prevState.refreshCount + 1
                }
            },
            prevState: arg.prevState
        });
    }
    return {
        ...arg.prevState,
        variables: []
    };
}

function handleDebugStart(arg: VariableReducerArg<ICellAction>): IVariableState {
    // If we haven't already turned on variables, do so now
    if (arg.prevState.showVariablesOnDebug) {
        return {
            ...arg.prevState,
            showVariablesOnDebug: false,
            visible: true
        };
    }
    return arg.prevState;
}

type VariableReducerFunctions<T> = {
    [P in keyof T]: T[P] extends never | undefined ? VariableReducerFunc : VariableReducerFunc<T[P]>;
};

type VariableActionMapping = VariableReducerFunctions<IInteractiveWindowMapping> &
    VariableReducerFunctions<CommonActionTypeMapping>;

// Create the map between message type and the actual function to call to update state
const reducerMap: Partial<VariableActionMapping> = {
    [InteractiveWindowMessages.RestartKernel]: handleRestarted,
    [InteractiveWindowMessages.FinishCell]: handleFinishCell,
    [InteractiveWindowMessages.ForceVariableRefresh]: handleRefresh,
    [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: toggleVariableExplorer,
    [CommonActionType.SET_VARIABLE_EXPLORER_HEIGHT]: setVariableExplorerHeight,
    [InteractiveWindowMessages.VariableExplorerHeightResponse]: handleVariableExplorerHeightResponse,
    [CommonActionType.GET_VARIABLE_DATA]: handleRequest,
    [InteractiveWindowMessages.GetVariablesResponse]: handleResponse,
    [CommonActionType.RUN_BY_LINE]: handleDebugStart
};

export function generateVariableReducer(
    showVariablesOnDebug: boolean
): Reducer<IVariableState, QueuableAction<Partial<VariableActionMapping>>> {
    // First create our default state.
    const defaultState: IVariableState = {
        currentExecutionCount: 0,
        variables: [],
        visible: false,
        sortAscending: true,
        sortColumn: 'name',
        pageSize: 5,
        containerHeight: 0,
        gridHeight: 200,
        refreshCount: 0,
        showVariablesOnDebug
    };

    // Then combine that with our map of state change message to reducer
    return combineReducers<IVariableState, Partial<VariableActionMapping>>(defaultState, reducerMap);
}
