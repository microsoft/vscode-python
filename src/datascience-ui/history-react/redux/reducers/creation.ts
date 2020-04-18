// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Identifiers } from '../../../../client/datascience/constants';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { ICell, IDataScienceExtraSettings } from '../../../../client/datascience/types';
import { removeLinesFromFrontAndBack } from '../../../common';
import { createCellVM, extractInputText, ICellViewModel, IMainState } from '../../../interactive-common/mainState';
import { postActionToExtension } from '../../../interactive-common/redux/helpers';
import { Helpers } from '../../../interactive-common/redux/reducers/helpers';
import { IAddCellAction, ICellAction } from '../../../interactive-common/redux/reducers/types';
import { InteractiveReducerArg } from '../mapping';

export namespace Creation {
    function isCellSupported(state: IMainState, cell: ICell): boolean {
        // Skip message cells in test mode
        if (state.testMode) {
            return cell.data.cell_type !== 'messages';
        }
        return true;
    }

    function extractInputBlockText(cellVM: ICellViewModel, settings?: IDataScienceExtraSettings) {
        // Use the base function first
        const text = extractInputText(cellVM, settings);

        // Then remove text on the front and back. We only do this for the interactive window
        return removeLinesFromFrontAndBack(text);
    }

    export function alterCellVM(
        cellVM: ICellViewModel,
        settings?: IDataScienceExtraSettings,
        visible?: boolean,
        expanded?: boolean
    ): ICellViewModel {
        if (cellVM.cell.data.cell_type === 'code') {
            // If we are already in the correct state, return back our initial cell vm
            if (cellVM.inputBlockShow === visible && cellVM.inputBlockOpen === expanded) {
                return cellVM;
            }

            const newCellVM = { ...cellVM };
            if (cellVM.inputBlockShow !== visible) {
                if (visible) {
                    // Show the cell, the rest of the function will add on correct collapse state
                    newCellVM.inputBlockShow = true;
                } else {
                    // Hide this cell
                    newCellVM.inputBlockShow = false;
                }
            }

            // No elseif as we want newly visible cells to pick up the correct expand / collapse state
            if (cellVM.inputBlockOpen !== expanded && cellVM.inputBlockCollapseNeeded && cellVM.inputBlockShow) {
                let newText = extractInputBlockText(cellVM, settings);

                // While extracting the text, we might eliminate all extra lines
                if (newText.includes('\n')) {
                    if (expanded) {
                        // Expand the cell
                        newCellVM.inputBlockOpen = true;
                        newCellVM.inputBlockText = newText;
                    } else {
                        // Collapse the cell
                        if (newText.length > 0) {
                            newText = newText.split('\n', 1)[0];
                            newText = newText.slice(0, 255); // Slice to limit length, slicing past length is fine
                            newText = newText.concat('...');
                        }

                        newCellVM.inputBlockOpen = false;
                        newCellVM.inputBlockText = newText;
                    }
                } else {
                    // If all lines eliminated, get rid of the collapse bar.
                    newCellVM.inputBlockCollapseNeeded = false;
                    newCellVM.inputBlockOpen = true;
                    newCellVM.inputBlockText = newText;
                }
            }

            return newCellVM;
        }

        return cellVM;
    }

    export function prepareCellVM(cell: ICell, mainState: IMainState): ICellViewModel {
        let cellVM: ICellViewModel = createCellVM(cell, mainState.settings, false, mainState.debugging);

        const visible = mainState.settings ? mainState.settings.showCellInputCode : false;
        const expanded = !mainState.settings?.collapseCellInputCodeByDefault;

        // Set initial cell visibility and collapse
        cellVM = alterCellVM(cellVM, mainState.settings, visible, expanded);
        cellVM.hasBeenRun = true;

        return cellVM;
    }

    export function startCell(arg: InteractiveReducerArg<ICell>): IMainState {
        if (isCellSupported(arg.prevState, arg.payload.data)) {
            const result = Helpers.updateOrAdd(arg, prepareCellVM);
            if (
                result.cellVMs.length > arg.prevState.cellVMs.length &&
                arg.payload.data.id !== Identifiers.EditCellId
            ) {
                const cellVM = result.cellVMs[result.cellVMs.length - 1];

                // We're adding a new cell here. Tell the intellisense engine we have a new cell
                postActionToExtension(arg, InteractiveWindowMessages.UpdateModel, {
                    source: 'user',
                    kind: 'add',
                    oldDirty: arg.prevState.dirty,
                    newDirty: true,
                    cell: cellVM.cell,
                    fullText: extractInputText(cellVM, result.settings),
                    currentText: cellVM.inputBlockText
                });
            }

            return result;
        }
        return arg.prevState;
    }

    export function updateCell(arg: InteractiveReducerArg<ICell>): IMainState {
        if (isCellSupported(arg.prevState, arg.payload.data)) {
            return Helpers.updateOrAdd(arg, prepareCellVM);
        }
        return arg.prevState;
    }

    export function finishCell(arg: InteractiveReducerArg<ICell>): IMainState {
        if (isCellSupported(arg.prevState, arg.payload.data)) {
            return Helpers.updateOrAdd(arg, prepareCellVM);
        }
        return arg.prevState;
    }

    export function deleteAllCells(arg: InteractiveReducerArg<IAddCellAction>): IMainState {
        // Send messages to other side to indicate the deletes
        postActionToExtension(arg, InteractiveWindowMessages.DeleteAllCells);

        return {
            ...arg.prevState,
            cellVMs: [],
            undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs)
        };
    }

    export function deleteCell(arg: InteractiveReducerArg<ICellAction>): IMainState {
        const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
        if (index >= 0 && arg.payload.data.cellId) {
            // Send messages to other side to indicate the delete
            postActionToExtension(arg, InteractiveWindowMessages.UpdateModel, {
                source: 'user',
                kind: 'remove',
                index,
                oldDirty: arg.prevState.dirty,
                newDirty: true,
                cell: arg.prevState.cellVMs[index].cell
            });

            const newVMs = arg.prevState.cellVMs.filter((_c, i) => i !== index);
            return {
                ...arg.prevState,
                cellVMs: newVMs,
                undoStack: Helpers.pushStack(arg.prevState.undoStack, arg.prevState.cellVMs)
            };
        }

        return arg.prevState;
    }

    export function unmount(arg: InteractiveReducerArg): IMainState {
        return {
            ...arg.prevState,
            cellVMs: [],
            undoStack: [],
            redoStack: [],
            editCellVM: undefined
        };
    }

    export function loaded(arg: InteractiveReducerArg<{ cells: ICell[] }>): IMainState {
        postActionToExtension(arg, InteractiveWindowMessages.LoadAllCellsComplete, {
            cells: []
        });
        return {
            ...arg.prevState,
            loaded: true,
            busy: false
        };
    }
}
