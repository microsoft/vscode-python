// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable, IJupyterVariablesResponse } from '../../../../client/datascience/types';
import { IMainState } from '../../../interactive-common/mainState';
import { IRefreshVariablesAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';

export namespace Variables {

    export function refreshVariables(arg: NativeEditorReducerArg<IRefreshVariablesAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.GetVariablesRequest,
            arg.payload.newExecutionCount === undefined ? arg.prevState.currentExecutionCount : arg.payload.newExecutionCount);
        return arg.prevState;
    }

    export function toggleVariableExplorer(arg: NativeEditorReducerArg): IMainState {
        const newState: IMainState = {
            ...arg.prevState,
            variablesVisible: !arg.prevState.variablesVisible
        };

        arg.postMessage(InteractiveWindowMessages.VariableExplorerToggle, newState.variablesVisible);

        // If going visible for the first time, refresh our variables
        if (newState.variablesVisible) {
            return refreshVariables({ ...arg, payload: { newExecutionCount: undefined } });
        } else {
            return newState;
        }
    }

    export function handleVariablesResponse(arg: NativeEditorReducerArg<IJupyterVariablesResponse>): IMainState {
        const variablesResponse = arg.payload as IJupyterVariablesResponse;

        // Check to see if we have moved to a new execution count only send our update if we are on the same count as the request
        if (variablesResponse.executionCount === arg.prevState.currentExecutionCount) {
            // Now put out a request for all of the sub values for the variables
            variablesResponse.variables.forEach(v => arg.postMessage(InteractiveWindowMessages.GetVariableValueRequest, v));

            return {
                ...arg.prevState,
                variables: variablesResponse.variables,
                pendingVariableCount: variablesResponse.variables.length
            };
        }

        return arg.prevState;
    }

    export function handleVariableResponse(arg: NativeEditorReducerArg<IJupyterVariable>): IMainState {
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
