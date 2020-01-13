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
            return {
                ...arg.prevState,
                variables: variablesResponse.variables
            };
        }

        return arg.prevState;
    }
}
