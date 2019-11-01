// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
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
}
