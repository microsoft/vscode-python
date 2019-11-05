// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../../interactive-common/mainState';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { InteractiveReducerArg } from '../mapping';

export namespace Execution {

    export function undo(arg: InteractiveReducerArg): IMainState {
        if (arg.prevState.undoStack.length > 0) {
            // Pop one off of our undo stack and update our redo
            const cells = arg.prevState.undoStack[arg.prevState.undoStack.length - 1];
            const undoStack = arg.prevState.undoStack.slice(0, arg.prevState.undoStack.length - 1);
            const redoStack = Helpers.pushStack(arg.prevState.redoStack, arg.prevState.cellVMs);
            arg.postMessage(InteractiveWindowMessages.Undo);
            return {
                ...arg.prevState,
                cellVMs: cells,
                undoStack: undoStack,
                redoStack: redoStack,
                skipNextScroll: true
            };
        }

        return arg.prevState;
    }

    export function redo(arg: InteractiveReducerArg): IMainState {
        if (arg.prevState.redoStack.length > 0) {
            // Pop one off of our redo stack and update our undo
            const cells = arg.prevState.redoStack[arg.prevState.undoStack.length - 1];
            const redoStack = arg.prevState.redoStack.slice(0, arg.prevState.redoStack.length - 1);
            const undoStack = Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs);
            arg.postMessage(InteractiveWindowMessages.Redo);
            return {
                ...arg.prevState,
                cellVMs: cells,
                undoStack: undoStack,
                redoStack: redoStack,
                skipNextScroll: true
            };
        }

        return arg.prevState;
    }

    export function startDebugging(arg: InteractiveReducerArg): IMainState {
        return {
            ...arg.prevState,
            debugging: true
        };
    }

    export function stopDebugging(arg: InteractiveReducerArg): IMainState {
        return {
            ...arg.prevState,
            debugging: false
        };
    }
}
