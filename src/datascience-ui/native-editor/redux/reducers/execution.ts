// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable-next-line: no-require-imports no-var-requires
const cloneDeep = require('lodash/cloneDeep');
import * as uuid from 'uuid/v4';
import { CellMatcher } from '../../../../client/datascience/cellMatcher';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CellState } from '../../../../client/datascience/types';
import { concatMultilineStringInput } from '../../../common';
import { createCellFrom } from '../../../common/cellFactory';
import { CursorPos, getSelectedAndFocusedInfo, ICellViewModel, IMainState } from '../../../interactive-common/mainState';
import { createIncomingActionWithPayload, postActionToExtension } from '../../../interactive-common/redux/helpers';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { Transfer } from '../../../interactive-common/redux/reducers/transfer';
import { CommonActionType, ICellAction, IChangeCellTypeAction, ICodeAction, IExecuteAction } from '../../../interactive-common/redux/reducers/types';
import { NativeEditorReducerArg } from '../mapping';
import { Effects } from './effects';

export namespace Execution {
    // tslint:disable-next-line: no-any
    function executeRange(prevState: IMainState, start: number, end: number, codes: string[], originalArg: NativeEditorReducerArg<any>): IMainState {
        const newVMs = [...prevState.cellVMs];
        for (let pos = start; pos <= end; pos += 1) {
            const orig = prevState.cellVMs[pos];
            const code = codes[pos - start];
            // noop if the submitted code is just a cell marker
            const matcher = new CellMatcher(prevState.settings);
            if (code && matcher.stripFirstMarker(code).length > 0) {
                // When cloning cells, preserve the metadata (hence deep clone).
                const clonedCell = cloneDeep(orig.cell.data);
                clonedCell.source = code;
                if (orig.cell.data.cell_type === 'code') {
                    // Update our input cell to be in progress again and clear outputs
                    clonedCell.outputs = [];
                    newVMs[pos] = Helpers.asCellViewModel({
                        ...orig,
                        inputBlockText: code,
                        cell: { ...orig.cell, state: CellState.executing, data: clonedCell }
                    });

                    // Send a message if a code cell
                    postActionToExtension(originalArg, InteractiveWindowMessages.ReExecuteCell, { code, id: orig.cell.id });
                } else {
                    // Update our input to be our new code
                    newVMs[pos] = Helpers.asCellViewModel({ ...orig, inputBlockText: code, cell: { ...orig.cell, data: clonedCell } });
                }
            }
        }

        return {
            ...prevState,
            cellVMs: newVMs
        };
    }

    export function executeAbove(arg: NativeEditorReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index > 0) {
            const codes = arg.prevState.cellVMs.filter((_c, i) => i < index).map(c => concatMultilineStringInput(c.cell.data.source));
            return executeRange(arg.prevState, 0, index - 1, codes, arg);
        }
        return arg.prevState;
    }

    export function executeCellAndAdvance(arg: NativeEditorReducerArg<IExecuteAction>): IMainState {
        arg.queueAction(
            createIncomingActionWithPayload(CommonActionType.EXECUTE_CELL, { cellId: arg.payload.data.cellId, code: arg.payload.data.code, moveOp: arg.payload.data.moveOp })
        );
        if (arg.payload.data.moveOp === 'add') {
            const newCellId = uuid();
            arg.queueAction(createIncomingActionWithPayload(CommonActionType.INSERT_BELOW, { cellId: arg.payload.data.cellId, newCellId }));
            arg.queueAction(createIncomingActionWithPayload(CommonActionType.FOCUS_CELL, { cellId: newCellId, cursorPos: CursorPos.Current }));
        }
        return arg.prevState;
    }

    export function executeCell(arg: NativeEditorReducerArg<IExecuteAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            // Start executing this cell.
            const executeResult = executeRange(arg.prevState, index, index, [arg.payload.data.code], arg);

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

    export function executeCellAndBelow(arg: NativeEditorReducerArg<ICodeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            const codes = arg.prevState.cellVMs.filter((_c, i) => i > index).map(c => concatMultilineStringInput(c.cell.data.source));
            return executeRange(arg.prevState, index, index + codes.length, [arg.payload.data.code, ...codes], arg);
        }
        return arg.prevState;
    }

    export function executeAllCells(arg: NativeEditorReducerArg): IMainState {
        // This is the same thing as executing the first cell and all below
        const firstCell = arg.prevState.cellVMs.length > 0 ? arg.prevState.cellVMs[0].cell.id : undefined;
        if (firstCell) {
            return executeCellAndBelow({
                ...arg,
                payload: { ...arg.payload, data: { cellId: firstCell, code: concatMultilineStringInput(arg.prevState.cellVMs[0].cell.data.source) } }
            });
        }

        return arg.prevState;
    }

    export function executeSelectedCell(arg: NativeEditorReducerArg): IMainState {
        // This is the same thing as executing the selected cell
        const selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === selectionInfo.selectedCellId);
        if (selectionInfo.selectedCellId && index >= 0) {
            return executeCell({
                ...arg,
                payload: {
                    ...arg.payload,
                    data: { cellId: selectionInfo.selectedCellId, code: concatMultilineStringInput(arg.prevState.cellVMs[index].cell.data.source), moveOp: 'none' }
                }
            });
        }

        return arg.prevState;
    }

    export function clearAllOutputs(arg: NativeEditorReducerArg): IMainState {
        const newList = arg.prevState.cellVMs.map(cellVM => {
            return Helpers.asCellViewModel({ ...cellVM, cell: { ...cellVM.cell, data: { ...cellVM.cell.data, outputs: [], execution_count: null } } });
        });

        Transfer.postModelClearOutputs(arg);

        return {
            ...arg.prevState,
            cellVMs: newList
        };
    }

    export function changeCellType(arg: NativeEditorReducerArg<IChangeCellTypeAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
        if (index >= 0) {
            const cellVMs = [...arg.prevState.cellVMs];
            const current = arg.prevState.cellVMs[index];
            const newType = current.cell.data.cell_type === 'code' ? 'markdown' : 'code';
            const newNotebookCell = createCellFrom(current.cell.data, newType);
            newNotebookCell.source = arg.payload.data.currentCode;
            const newCell: ICellViewModel = {
                ...current,
                inputBlockText: arg.payload.data.currentCode,
                cell: {
                    ...current.cell,
                    data: newNotebookCell
                }
            };
            // tslint:disable-next-line: no-any
            cellVMs[index] = newCell as any; // This is because IMessageCell doesn't fit in here. But message cells can't change type
            if (newType === 'code') {
                Transfer.postModelInsert(arg, index, cellVMs[index].cell, Helpers.firstCodeCellAbove(arg.prevState, current.cell.id));
            } else {
                Transfer.postModelRemove(arg, index, current.cell);
            }

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
}
