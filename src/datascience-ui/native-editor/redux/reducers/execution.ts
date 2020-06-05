// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable-next-line: no-require-imports no-var-requires
const cloneDeep = require('lodash/cloneDeep');
import * as uuid from 'uuid/v4';
import { DebugProtocol } from 'vscode-debugprotocol';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState, ICell } from '../../../../client/datascience/types';
import { concatMultilineStringInput } from '../../../common';
import { createCellFrom } from '../../../common/cellFactory';
import {
    CursorPos,
    DebugState,
    getSelectedAndFocusedInfo,
    ICellViewModel,
    IMainState
} from '../../../interactive-common/mainState';
import { postActionToExtension, queueIncomingActionWithPayload } from '../../../interactive-common/redux/helpers';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import {
    CommonActionType,
    ICellAction,
    IChangeCellTypeAction,
    IExecuteAction
} from '../../../interactive-common/redux/reducers/types';
import { NativeEditorReducerArg } from '../mapping';
import { Effects } from './effects';

export namespace Execution {
    function executeRange(
        prevState: IMainState,
        cellIds: string[],
        // tslint:disable-next-line: no-any
        originalArg: NativeEditorReducerArg<any>
    ): IMainState {
        const newVMs = [...prevState.cellVMs];
        const cellIdsToExecute: string[] = [];
        cellIds.forEach((cellId) => {
            const index = prevState.cellVMs.findIndex((cell) => cell.cell.id === cellId);
            if (index === -1) {
                return;
            }
            const orig = prevState.cellVMs[index];
            // noop if the submitted code is just a cell marker
            if (orig.cell.data.cell_type === 'code' && concatMultilineStringInput(orig.cell.data.source)) {
                // When cloning cells, preserve the metadata (hence deep clone).
                const clonedCell = cloneDeep(orig.cell.data);
                // Update our input cell to be in progress again and clear outputs
                clonedCell.outputs = [];
                newVMs[index] = Helpers.asCellViewModel({
                    ...orig,
                    cell: { ...orig.cell, state: CellState.executing, data: clonedCell }
                });
                cellIdsToExecute.push(orig.cell.id);
            }
        });

        // If any cells to execute, execute them all
        if (cellIdsToExecute.length > 0) {
            // Send a message if a code cell
            postActionToExtension(originalArg, InteractiveWindowMessages.ReExecuteCells, {
                cellIds: cellIdsToExecute
            });
        }

        return {
            ...prevState,
            cellVMs: newVMs
        };
    }

    export function executeAbove(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        if (index > 0) {
            // Get all cellIds until `index`.
            const cellIds = arg.prevState.cellVMs.slice(0, index).map((cellVm) => cellVm.cell.id);
            return executeRange(arg.prevState, cellIds, arg);
        }
        return arg.prevState;
    }

    export function executeCellAndAdvance(arg: NativeEditorReducerArg<IExecuteAction>): IMainState {
        queueIncomingActionWithPayload(arg, CommonActionType.EXECUTE_CELL, {
            cellId: arg.payload.data.cellId,
            moveOp: arg.payload.data.moveOp
        });
        if (arg.payload.data.moveOp === 'add') {
            const newCellId = uuid();
            queueIncomingActionWithPayload(arg, CommonActionType.INSERT_BELOW, {
                cellId: arg.payload.data.cellId,
                newCellId
            });
            queueIncomingActionWithPayload(arg, CommonActionType.FOCUS_CELL, {
                cellId: newCellId,
                cursorPos: CursorPos.Current
            });
        }
        return arg.prevState;
    }

    export function executeCell(arg: NativeEditorReducerArg<IExecuteAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        if (index >= 0 && arg.payload.data.cellId) {
            // Start executing this cell.
            const executeResult = executeRange(arg.prevState, [arg.payload.data.cellId], arg);

            // Modify the execute result if moving
            if (arg.payload.data.moveOp === 'select') {
                // Select the cell below this one, but don't focus it
                if (index < arg.prevState.cellVMs.length - 1) {
                    return Effects.selectCell(
                        {
                            ...arg,
                            prevState: {
                                ...executeResult
                            },
                            payload: {
                                ...arg.payload,
                                data: {
                                    ...arg.payload.data,
                                    cellId: arg.prevState.cellVMs[index + 1].cell.id,
                                    cursorPos: CursorPos.Current
                                }
                            }
                        },
                        // Select the next cell, but do not set focus to it.
                        false
                    );
                }
                return executeResult;
            } else {
                return executeResult;
            }
        }
        return arg.prevState;
    }

    export function executeCellAndBelow(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            // Get all cellIds starting from `index`.
            const cellIds = arg.prevState.cellVMs.slice(index).map((cellVm) => cellVm.cell.id);
            return executeRange(arg.prevState, cellIds, arg);
        }
        return arg.prevState;
    }

    export function executeAllCells(arg: NativeEditorReducerArg): IMainState {
        if (arg.prevState.cellVMs.length > 0) {
            const cellIds = arg.prevState.cellVMs.map((cellVm) => cellVm.cell.id);
            return executeRange(arg.prevState, cellIds, arg);
        }
        return arg.prevState;
    }

    export function executeSelectedCell(arg: NativeEditorReducerArg): IMainState {
        // This is the same thing as executing the selected cell
        const selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === selectionInfo.selectedCellId);
        if (selectionInfo.selectedCellId && index >= 0) {
            return executeCell({
                ...arg,
                payload: {
                    ...arg.payload,
                    data: {
                        cellId: selectionInfo.selectedCellId,
                        moveOp: 'none'
                    }
                }
            });
        }

        return arg.prevState;
    }

    export function clearAllOutputs(arg: NativeEditorReducerArg): IMainState {
        const newList = arg.prevState.cellVMs.map((cellVM) => {
            return Helpers.asCellViewModel({
                ...cellVM,
                cell: { ...cellVM.cell, data: { ...cellVM.cell.data, outputs: [], execution_count: null } }
            });
        });

        Transfer.postModelClearOutputs(arg);

        return {
            ...arg.prevState,
            cellVMs: newList
        };
    }

    export function changeCellType(arg: NativeEditorReducerArg<IChangeCellTypeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            const cellVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newType = current.cell.data.cell_type === 'code' ? 'markdown' : 'code';
            const newNotebookCell = createCellFrom(current.cell.data, newType);
            const newCell: ICellViewModel = {
                ...current,
                cell: {
                    ...current.cell,
                    data: newNotebookCell
                }
            };
            cellVMs[index] = newCell;
            Transfer.changeCellType(arg, cellVMs[index].cell);

            return {
                ...arg.prevState,
                cellVMs
            };
        }

        return arg.prevState;
    }

    export function undo(arg: NativeEditorReducerArg): IMainState {
        if (arg.prevState.undoStack.length > 0) {
            // Pop one off of our undo stack and update our redo
            const cells = arg.prevState.undoStack[arg.prevState.undoStack.length - 1];
            const undoStack = arg.prevState.undoStack.slice(0, arg.prevState.undoStack.length - 1);
            const redoStack = Helpers.pushStack(arg.prevState.redoStack, arg.prevState.cellVMs);
            postActionToExtension(arg, InteractiveWindowMessages.Undo);
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

    export function redo(arg: NativeEditorReducerArg): IMainState {
        if (arg.prevState.redoStack.length > 0) {
            // Pop one off of our redo stack and update our undo
            const cells = arg.prevState.redoStack[arg.prevState.redoStack.length - 1];
            const redoStack = arg.prevState.redoStack.slice(0, arg.prevState.redoStack.length - 1);
            const undoStack = Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs);
            postActionToExtension(arg, InteractiveWindowMessages.Redo);
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

    export function continueExec(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((cv) => cv.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            postActionToExtension(arg, InteractiveWindowMessages.Continue);
        }
        return arg.prevState;
    }

    export function step(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((cv) => cv.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            postActionToExtension(arg, InteractiveWindowMessages.Step);
        }
        return arg.prevState;
    }

    export function runByLine(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((cv) => cv.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            postActionToExtension(arg, InteractiveWindowMessages.RunByLine, {
                cell: arg.prevState.cellVMs[index].cell,
                expectedExecutionCount: arg.prevState.currentExecutionCount + 1
            });
            const newVM = {
                ...arg.prevState.cellVMs[index],
                runningByLine: DebugState.Run
            };
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = newVM;
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function handleBreakState(
        arg: NativeEditorReducerArg<{ frames: DebugProtocol.StackFrame[]; cell: ICell }>
    ): IMainState {
        const index = arg.prevState.cellVMs.findIndex((cv) => cv.cell.id === arg.payload.data.cell.id);
        if (index >= 0) {
            const newVM = {
                ...arg.prevState.cellVMs[index],
                runningByLine: DebugState.Break,
                currentStack: arg.payload.data.frames
            };
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = newVM;
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function handleContinue(arg: NativeEditorReducerArg<ICell>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((cv) => cv.cell.id === arg.payload.data.id);
        if (index >= 0) {
            const newVM = {
                ...arg.prevState.cellVMs[index],
                runningByLine: DebugState.Run,
                currentStack: undefined
            };
            const newVMs = [...arg.prevState.cellVMs];
            newVMs[index] = newVM;
            return {
                ...arg.prevState,
                cellVMs: newVMs
            };
        }
        return arg.prevState;
    }

    export function startDebugging(arg: NativeEditorReducerArg): IMainState {
        return {
            ...arg.prevState,
            debugging: true
        };
    }

    export function stopDebugging(arg: NativeEditorReducerArg): IMainState {
        // Clear out any cells that have frames
        const index = arg.prevState.cellVMs.findIndex((cvm) => cvm.currentStack);
        const newVMs = [...arg.prevState.cellVMs];
        if (index >= 0) {
            const newVM = {
                ...newVMs[index],
                currentStack: undefined
            };
            newVMs[index] = newVM;
        }
        return {
            ...arg.prevState,
            cellVMs: newVMs,
            debugging: false
        };
    }
}
