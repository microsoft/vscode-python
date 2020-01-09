// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages, IRefreshVariablesRequest } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable, IJupyterVariablesResponse } from '../../../../client/datascience/types';
import { IMainState } from '../../../interactive-common/mainState';
import { createPostableAction } from '../postOffice';
import { CommonReducerArg } from './types';

export namespace Variables {
    export function refreshVariables<T>(arg: CommonReducerArg<T, IRefreshVariablesRequest>): IMainState {
        arg.queueAction(
            createPostableAction(
                InteractiveWindowMessages.GetVariablesRequest,
                arg.payload.newExecutionCount === undefined ? arg.prevState.currentExecutionCount : arg.payload.newExecutionCount
            )
        );
        return arg.prevState;
    }

    export function toggleVariableExplorer<T>(arg: CommonReducerArg<T>): IMainState {
        const newState: IMainState = {
            ...arg.prevState,
            variablesVisible: !arg.prevState.variablesVisible
        };

        arg.queueAction(createPostableAction(InteractiveWindowMessages.VariableExplorerToggle, newState.variablesVisible));

        // If going visible for the first time, refresh our variables
        if (newState.variablesVisible) {
            return refreshVariables({ ...arg, prevState: newState, payload: { newExecutionCount: undefined } });
        } else {
            return newState;
        }
    }

    export function handleVariablesResponse<T>(arg: CommonReducerArg<T, IJupyterVariablesResponse>): IMainState {
        const variablesResponse = arg.payload as IJupyterVariablesResponse;

        // Check to see if we have moved to a new execution count only send our update if we are on the same count as the request
        if (variablesResponse.executionCount === arg.prevState.currentExecutionCount) {
            // Now put out a request for all of the sub values for the variables
            variablesResponse.variables.forEach(v => arg.queueAction(createPostableAction(InteractiveWindowMessages.GetVariableValueRequest, v)));

            return {
                ...arg.prevState,
                variables: variablesResponse.variables,
                pendingVariableCount: variablesResponse.variables.length
            };
        }

        return arg.prevState;
    }

    export function handleVariableResponse<T>(arg: CommonReducerArg<T, IJupyterVariable>): IMainState {
        const variable = arg.payload as IJupyterVariable;

        // Only send the updated variable data if we are on the same execution count as when we requested it
        if (variable && variable.executionCount !== undefined && variable.executionCount === arg.prevState.currentExecutionCount) {
            const stateVariable = arg.prevState.variables.findIndex(v => v.name === variable.name);
            if (stateVariable >= 0) {
                const newState = [...arg.prevState.variables];
                newState.splice(stateVariable, 1, variable);
                return {
                    ...arg.prevState,
                    variables: newState,
                    pendingVariableCount: Math.max(0, arg.prevState.pendingVariableCount - 1)
                };
            }
        }

        return arg.prevState;
    }
}
