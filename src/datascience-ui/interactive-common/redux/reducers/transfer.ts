// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Identifiers } from '../../../../client/datascience/constants';
import { IEditorContentChange, InteractiveWindowMessages, NotebookModelChange } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages } from '../../../../client/datascience/messages';
import { ICell } from '../../../../client/datascience/types';
import { extractInputText, IMainState } from '../../mainState';
import { createPostableAction } from '../postOffice';
import { Helpers } from './helpers';
import { CommonReducerArg, ICellAction, IEditCellAction, ILinkClickAction, ISendCommandAction, IShowDataViewerAction, IShowPlotAction } from './types';

// These are all reducers that don't actually change state. They merely dispatch a message to the other side.
export namespace Transfer {
    export function exportCells<T>(arg: CommonReducerArg<T>): IMainState {
        const cellContents = arg.prevState.cellVMs.map(v => v.cell);
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Export, cellContents));

        // Indicate busy
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function save<T>(arg: CommonReducerArg<T>): IMainState {
        // Note: this is assuming editor contents have already been saved. That should happen as a result of focus change

        // Actually waiting for save results before marking as not dirty, so don't do it here.
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SaveAll, { cells: arg.prevState.cellVMs.map(cvm => cvm.cell) }));
        return arg.prevState;
    }

    export function showDataViewer<T>(arg: CommonReducerArg<T, IShowDataViewerAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ShowDataViewer, { variable: arg.payload.variable, columnSize: arg.payload.columnSize }));
        return arg.prevState;
    }

    export function sendCommand<T>(arg: CommonReducerArg<T, ISendCommandAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.NativeCommand, { command: arg.payload.command, source: arg.payload.commandType }));
        return arg.prevState;
    }

    export function showPlot<T>(arg: CommonReducerArg<T, IShowPlotAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ShowPlot, arg.payload.imageHtml));
        return arg.prevState;
    }

    export function linkClick<T>(arg: CommonReducerArg<T, ILinkClickAction>): IMainState {
        if (arg.payload.href.startsWith('data:image/png')) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.SavePng, arg.payload.href));
        } else {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.OpenLink, arg.payload.href));
        }
        return arg.prevState;
    }

    export function getAllCells<T>(arg: CommonReducerArg<T>): IMainState {
        const cells = arg.prevState.cellVMs.map(c => c.cell);
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ReturnAllCells, cells));
        return arg.prevState;
    }

    export function gotoCell<T>(arg: CommonReducerArg<T, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (cellVM && cellVM.cell.data.cell_type === 'code') {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.GotoCodeCell, { file: cellVM.cell.file, line: cellVM.cell.line }));
        }
        return arg.prevState;
    }

    export function copyCellCode<T>(arg: CommonReducerArg<T, ICellAction>): IMainState {
        let cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (!cellVM && arg.prevState.editCellVM && arg.payload.cellId === arg.prevState.editCellVM.cell.id) {
            cellVM = arg.prevState.editCellVM;
        }

        // Send a message to the other side to jump to a particular cell
        if (cellVM) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.CopyCodeCell, { source: extractInputText(cellVM, arg.prevState.settings) }));
        }

        return arg.prevState;
    }

    export function gather<T>(arg: CommonReducerArg<T, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (cellVM) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.GatherCodeRequest, cellVM.cell));
        }
        return arg.prevState;
    }

    function postModelUpdate<T>(arg: CommonReducerArg<T>, update: NotebookModelChange) {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.UpdateModel, update));
    }

    export function postModelEdit<T>(arg: CommonReducerArg<T>, forward: IEditorContentChange[], reverse: IEditorContentChange[], id: string) {
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

    export function postModelInsert<T>(arg: CommonReducerArg<T>, index: number, cell: ICell, codeCellAboveId?: string) {
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

    export function postModelRemove<T>(arg: CommonReducerArg<T>, index: number, cell: ICell) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'remove',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            cell,
            index
        });
    }

    export function postModelClearOutputs<T>(arg: CommonReducerArg<T>) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'clear',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            // tslint:disable-next-line: no-any
            oldCells: arg.prevState.cellVMs.map(c => c.cell as any) as ICell[]
        });
    }

    export function postModelRemoveAll<T>(arg: CommonReducerArg<T>, newCellId: string) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'remove_all',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            // tslint:disable-next-line: no-any
            oldCells: arg.prevState.cellVMs.map(c => c.cell as any) as ICell[],
            newCellId
        });
    }

    export function postModelSwap<T>(arg: CommonReducerArg<T>, firstCellId: string, secondCellId: string) {
        postModelUpdate(arg, {
            source: 'user',
            kind: 'swap',
            oldDirty: arg.prevState.dirty,
            newDirty: true,
            firstCellId,
            secondCellId
        });
    }

    export function editCell<T>(arg: CommonReducerArg<T, IEditCellAction>): IMainState {
        const cellVM = arg.payload.cellId === Identifiers.EditCellId ? arg.prevState.editCellVM : arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.cellId);
        if (cellVM) {
            // Tell the underlying model on the extension side
            postModelEdit(arg, arg.payload.forward, arg.payload.reverse, cellVM.cell.id);

            // Update the uncommitted text on the cell view model
            // We keep this saved here so we don't re-render and we put this code into the input / code data
            // when focus is lost
            const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.cellId);
            if (index >= 0 && arg.prevState.focusedCellId === arg.payload.cellId) {
                const newVMs = [...arg.prevState.cellVMs];
                const current = arg.prevState.cellVMs[index];
                const newCell = {
                    ...current,
                    uncommittedText: arg.payload.code,
                    codeVersion: arg.payload.version
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

    export function started<T>(arg: CommonReducerArg<T>): IMainState {
        // Send all of our initial requests
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Started));
        arg.queueAction(createPostableAction(CssMessages.GetCssRequest, { isDark: arg.prevState.baseTheme !== 'vscode-light' }));
        arg.queueAction(createPostableAction(CssMessages.GetMonacoThemeRequest, { isDark: arg.prevState.baseTheme !== 'vscode-light' }));
        arg.queueAction(createPostableAction(InteractiveWindowMessages.LoadOnigasmAssemblyRequest));
        arg.queueAction(createPostableAction(InteractiveWindowMessages.LoadTmLanguageRequest));
        return arg.prevState;
    }

    export function loadedAllCells<T>(arg: CommonReducerArg<T>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.LoadAllCellsComplete, { cells: arg.prevState.cellVMs.map(c => c.cell) }));
        return arg.prevState;
    }
}
