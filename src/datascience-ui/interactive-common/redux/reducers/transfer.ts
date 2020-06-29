// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Identifiers } from '../../../../client/datascience/constants';
import {
    IEditorContentChange,
    InteractiveWindowMessages,
    NotebookModelChange
} from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages } from '../../../../client/datascience/messages';
import { ICell } from '../../../../client/datascience/types';
import { extractInputText, getSelectedAndFocusedInfo, IMainState } from '../../mainState';
import { isSyncingMessage, postActionToExtension } from '../helpers';
import { Helpers } from './helpers';
import {
    CommonActionType,
    CommonReducerArg,
    ICellAction,
    IEditCellAction,
    ILinkClickAction,
    ISendCommandAction,
    IShowDataViewerAction
} from './types';

// These are all reducers that don't actually change state. They merely dispatch a message to the other side.
export namespace Transfer {
    export function exportCells(arg: CommonReducerArg): IMainState {
        const cellContents = arg.prevState.cellVMs.map((v) => v.cell);
        postActionToExtension(arg, InteractiveWindowMessages.Export, cellContents);

        // Indicate busy
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function showExportAsMenu(arg: CommonReducerArg): IMainState {
        postActionToExtension(arg, InteractiveWindowMessages.ExportNotebookAs, arg.payload.data); // want to send filename
        return arg.prevState;
    }

    export function save(arg: CommonReducerArg): IMainState {
        // Note: this is assuming editor contents have already been saved. That should happen as a result of focus change

        // Actually waiting for save results before marking as not dirty, so don't do it here.
        postActionToExtension(arg, InteractiveWindowMessages.SaveAll, {
            cells: arg.prevState.cellVMs.map((cvm) => cvm.cell)
        });
        return arg.prevState;
    }

    export function showDataViewer(arg: CommonReducerArg<CommonActionType, IShowDataViewerAction>): IMainState {
        postActionToExtension(arg, InteractiveWindowMessages.ShowDataViewer, {
            variable: arg.payload.data.variable,
            columnSize: arg.payload.data.columnSize
        });
        return arg.prevState;
    }

    export function sendCommand(arg: CommonReducerArg<CommonActionType, ISendCommandAction>): IMainState {
        postActionToExtension(arg, InteractiveWindowMessages.NativeCommand, {
            command: arg.payload.data.command
        });
        return arg.prevState;
    }

    export function showPlot(
        arg: CommonReducerArg<CommonActionType | InteractiveWindowMessages, string | undefined>
    ): IMainState {
        if (arg.payload.data) {
            postActionToExtension(arg, InteractiveWindowMessages.ShowPlot, arg.payload.data);
        }
        return arg.prevState;
    }

    export function launchNotebookTrustPrompt(arg: CommonReducerArg) {
        postActionToExtension(arg, InteractiveWindowMessages.LaunchNotebookTrustPrompt);
        return arg.prevState;
    }

    export function linkClick(arg: CommonReducerArg<CommonActionType, ILinkClickAction>): IMainState {
        if (arg.payload.data.href.startsWith('data:image/png')) {
            postActionToExtension(arg, InteractiveWindowMessages.SavePng, arg.payload.data.href);
        } else {
            postActionToExtension(arg, InteractiveWindowMessages.OpenLink, arg.payload.data.href);
        }
        return arg.prevState;
    }

    export function getAllCells(arg: CommonReducerArg): IMainState {
        const cells = arg.prevState.cellVMs.map((c) => c.cell);
        postActionToExtension(arg, InteractiveWindowMessages.ReturnAllCells, cells);
        return arg.prevState;
    }

    export function gotoCell(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find((c) => c.cell.id === arg.payload.data.cellId);
        if (cellVM && cellVM.cell.data.cell_type === 'code') {
            postActionToExtension(arg, InteractiveWindowMessages.GotoCodeCell, {
                file: cellVM.cell.file,
                line: cellVM.cell.line
            });
        }
        return arg.prevState;
    }

    export function copyCellCode(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        let cellVM = arg.prevState.cellVMs.find((c) => c.cell.id === arg.payload.data.cellId);
        if (!cellVM && arg.prevState.editCellVM && arg.payload.data.cellId === arg.prevState.editCellVM.cell.id) {
            cellVM = arg.prevState.editCellVM;
        }

        // Send a message to the other side to jump to a particular cell
        if (cellVM) {
            postActionToExtension(arg, InteractiveWindowMessages.CopyCodeCell, {
                source: extractInputText(cellVM, arg.prevState.settings)
            });
        }

        return arg.prevState;
    }

    export function gather(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find((c) => c.cell.id === arg.payload.data.cellId);
        if (cellVM) {
            postActionToExtension(arg, InteractiveWindowMessages.GatherCode, cellVM.cell);
        }
        return arg.prevState;
    }

    export function gatherToScript(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find((c) => c.cell.id === arg.payload.data.cellId);
        if (cellVM) {
            postActionToExtension(arg, InteractiveWindowMessages.GatherCodeToScript, cellVM.cell);
        }
        return arg.prevState;
    }

    function postModelUpdate<T>(arg: CommonReducerArg<CommonActionType, T>, update: NotebookModelChange) {
        postActionToExtension(arg, InteractiveWindowMessages.UpdateModel, update);
    }

    export function postModelEdit<T>(
        arg: CommonReducerArg<CommonActionType, T>,
        forward: IEditorContentChange[],
        reverse: IEditorContentChange[],
        id: string
    ) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'edit',
            newDirty: true,
            oldDirty: arg.prevState.dirty,
            forward,
            reverse,
            id
        });
    }

    export function postModelInsert<T>(
        arg: CommonReducerArg<CommonActionType, T>,
        index: number,
        cell: ICell,
        codeCellAboveId?: string
    ) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'insert',
            newDirty: true,
            oldDirty: arg.prevState.dirty,
            index,
            cell,
            codeCellAboveId
        });
    }

    export function changeCellType<T>(arg: CommonReducerArg<CommonActionType, T>, cell: ICell) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'changeCellType',
            newDirty: true,
            oldDirty: arg.prevState.dirty,
            cell
        });
    }

    export function postModelRemove<T>(arg: CommonReducerArg<CommonActionType, T>, index: number, cell: ICell) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'remove',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            cell,
            index
        });
    }

    export function postModelClearOutputs<T>(arg: CommonReducerArg<CommonActionType, T>) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'clear',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            // tslint:disable-next-line: no-any
            oldCells: arg.prevState.cellVMs.map((c) => c.cell as any) as ICell[]
        });
    }

    export function postModelCellUpdate<T>(
        arg: CommonReducerArg<CommonActionType, T>,
        newCells: ICell[],
        oldCells: ICell[]
    ) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'modify',
            newCells,
            oldCells,
            oldDirty: arg.prevState.dirty,
            newDirty: true
        });
    }

    export function postModelRemoveAll<T>(arg: CommonReducerArg<CommonActionType, T>, newCellId: string) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'remove_all',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            // tslint:disable-next-line: no-any
            oldCells: arg.prevState.cellVMs.map((c) => c.cell as any) as ICell[],
            newCellId
        });
    }

    export function postModelSwap<T>(
        arg: CommonReducerArg<CommonActionType, T>,
        firstCellId: string,
        secondCellId: string
    ) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'swap',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            firstCellId,
            secondCellId
        });
    }

    export function editCell(arg: CommonReducerArg<CommonActionType, IEditCellAction>): IMainState {
        const cellVM =
            arg.payload.data.cellId === Identifiers.EditCellId
                ? arg.prevState.editCellVM
                : arg.prevState.cellVMs.find((c) => c.cell.id === arg.payload.data.cellId);
        if (cellVM) {
            // Tell the underlying model on the extension side
            postModelEdit(arg, arg.payload.data.forward, arg.payload.data.reverse, cellVM.cell.id);

            // Update the uncommitted text on the cell view model
            // We keep this saved here so we don't re-render and we put this code into the input / code data
            // when focus is lost
            const index = arg.prevState.cellVMs.findIndex((c) => c.cell.id === arg.payload.data.cellId);
            const selectionInfo = getSelectedAndFocusedInfo(arg.prevState);
            // If this is the focused cell, then user is editing it, hence it needs to be updated.
            const isThisTheFocusedCell = selectionInfo.focusedCellId === arg.payload.data.cellId;
            // If this edit is part of a sycning comging from another notebook, then we need to update it again.
            const isSyncFromAnotherNotebook = isSyncingMessage(arg.payload.messageType);
            if (index >= 0 && (isThisTheFocusedCell || isSyncFromAnotherNotebook)) {
                const newVMs = [...arg.prevState.cellVMs];
                const current = arg.prevState.cellVMs[index];
                const newCell = {
                    ...current,
                    inputBlockText: arg.payload.data.code,
                    cell: {
                        ...current.cell,
                        data: {
                            ...current.cell.data,
                            source: arg.payload.data.code
                        }
                    },
                    codeVersion: arg.payload.data.version
                };

                // tslint:disable-next-line: no-any
                newVMs[index] = Helpers.asCellViewModel(newCell); // This is because IMessageCell doesn't fit in here
                return {
                    ...arg.prevState,
                    cellVMs: newVMs
                };
            }
        }
        return arg.prevState;
    }

    export function started(arg: CommonReducerArg): IMainState {
        // Send all of our initial requests
        postActionToExtension(arg, InteractiveWindowMessages.Started);
        postActionToExtension(arg, CssMessages.GetCssRequest, { isDark: arg.prevState.baseTheme !== 'vscode-light' });
        postActionToExtension(arg, CssMessages.GetMonacoThemeRequest, {
            isDark: arg.prevState.baseTheme !== 'vscode-light'
        });
        return arg.prevState;
    }

    export function loadedAllCells(arg: CommonReducerArg): IMainState {
        postActionToExtension(arg, InteractiveWindowMessages.LoadAllCellsComplete, {
            cells: arg.prevState.cellVMs.map((c) => c.cell)
        });
        return arg.prevState;
    }
}
