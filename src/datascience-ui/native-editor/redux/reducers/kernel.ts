// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../../interactive-common/mainState';
import { NativeEditorReducerArg } from '../mapping';

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
}
