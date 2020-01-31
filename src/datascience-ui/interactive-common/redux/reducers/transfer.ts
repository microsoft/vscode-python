// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages } from '../../../../client/datascience/messages';
import { extractInputText, IMainState } from '../../mainState';
import { createPostableAction } from '../postOffice';
import { Helpers } from './helpers';
import { CommonActionType, CommonReducerArg, ICellAction, IEditCellAction, ILinkClickAction, ISendCommandAction, IShowDataViewerAction } from './types';

// These are all reducers that don't actually change state. They merely dispatch a message to the other side.
export namespace Transfer {
    export function exportCells(arg: CommonReducerArg): IMainState {
        const cellContents = arg.prevState.cellVMs.map(v => v.cell);
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Export, cellContents));

        // Indicate busy
        return {
            ...arg.prevState,
            busy: true
        };
    }

    export function save(arg: CommonReducerArg): IMainState {
        // Note: this is assuming editor contents have already been saved. That should happen as a result of focus change

        // Actually waiting for save results before marking as not dirty, so don't do it here.
        arg.queueAction(createPostableAction(InteractiveWindowMessages.SaveAll, { cells: arg.prevState.cellVMs.map(cvm => cvm.cell) }));
        return arg.prevState;
    }

    export function showDataViewer(arg: CommonReducerArg<CommonActionType, IShowDataViewerAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ShowDataViewer, { variable: arg.payload.data.variable, columnSize: arg.payload.data.columnSize }));
        return arg.prevState;
    }

    export function sendCommand(arg: CommonReducerArg<CommonActionType, ISendCommandAction>): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.NativeCommand, { command: arg.payload.data.command, source: arg.payload.data.commandType }));
        return arg.prevState;
    }

    export function showPlot(arg: CommonReducerArg<CommonActionType | InteractiveWindowMessages, string | undefined>): IMainState {
        if (arg.payload.data) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.ShowPlot, arg.payload.data));
        }
        return arg.prevState;
    }

    export function linkClick(arg: CommonReducerArg<CommonActionType, ILinkClickAction>): IMainState {
        if (arg.payload.data.href.startsWith('data:image/png')) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.SavePng, arg.payload.data.href));
        } else {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.OpenLink, arg.payload.data.href));
        }
        return arg.prevState;
    }

    export function getAllCells(arg: CommonReducerArg): IMainState {
        const cells = arg.prevState.cellVMs.map(c => c.cell);
        arg.queueAction(createPostableAction(InteractiveWindowMessages.ReturnAllCells, cells));
        return arg.prevState;
    }

    export function gotoCell(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.data.cellId);
        if (cellVM && cellVM.cell.data.cell_type === 'code') {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.GotoCodeCell, { file: cellVM.cell.file, line: cellVM.cell.line }));
        }
        return arg.prevState;
    }

    export function copyCellCode(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        let cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.data.cellId);
        if (!cellVM && arg.prevState.editCellVM && arg.payload.data.cellId === arg.prevState.editCellVM.cell.id) {
            cellVM = arg.prevState.editCellVM;
        }

        // Send a message to the other side to jump to a particular cell
        if (cellVM) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.CopyCodeCell, { source: extractInputText(cellVM, arg.prevState.settings) }));
        }

        return arg.prevState;
    }

    export function gather(arg: CommonReducerArg<CommonActionType, ICellAction>): IMainState {
        const cellVM = arg.prevState.cellVMs.find(c => c.cell.id === arg.payload.data.cellId);
        if (cellVM) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.GatherCodeRequest, cellVM.cell));
        }
        return arg.prevState;
    }

    export function editCell(arg: CommonReducerArg<CommonActionType, IEditCellAction>): IMainState {
        if (arg.payload.data.cellId) {
            arg.queueAction(createPostableAction(InteractiveWindowMessages.EditCell, { changes: arg.payload.data.changes, id: arg.payload.data.cellId }));

            // Update the uncomitted text on the cell view model
            // We keep this saved here so we don't re-render and we put this code into the input / code data
            // when focus is lost
            const index = arg.prevState.cellVMs.findIndex(c => c.cell.id === arg.payload.data.cellId);
            if (index >= 0 && arg.prevState.focusedCellId === arg.payload.data.cellId) {
                const newVMs = [...arg.prevState.cellVMs];
                const current = arg.prevState.cellVMs[index];
                const newCell = {
                    ...current,
                    uncomittedText: arg.payload.data.code
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
        arg.queueAction(createPostableAction(InteractiveWindowMessages.Started));
        arg.queueAction(createPostableAction(CssMessages.GetCssRequest, { isDark: arg.prevState.baseTheme !== 'vscode-light' }));
        arg.queueAction(createPostableAction(CssMessages.GetMonacoThemeRequest, { isDark: arg.prevState.baseTheme !== 'vscode-light' }));
        arg.queueAction(createPostableAction(InteractiveWindowMessages.LoadOnigasmAssemblyRequest));
        arg.queueAction(createPostableAction(InteractiveWindowMessages.LoadTmLanguageRequest));
        return arg.prevState;
    }

    export function loadedAllCells(arg: CommonReducerArg): IMainState {
        arg.queueAction(createPostableAction(InteractiveWindowMessages.LoadAllCellsComplete, { cells: arg.prevState.cellVMs.map(c => c.cell) }));
        return arg.prevState;
    }
}
