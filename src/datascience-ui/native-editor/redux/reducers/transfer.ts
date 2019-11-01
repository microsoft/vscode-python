// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../../interactive-common/mainState';
import { ISendCommandAction, IShowDataViewerAction, IShowPlotAction, IOpenLinkAction } from '../actions';
import { NativeEditorReducerArg } from '../mapping';

export namespace Transfer {
    export function exportCells(arg: NativeEditorReducerArg): IMainState {
        const cellContents = arg.prevState.cellVMs.map(v => v.cell);
        arg.postMessage(InteractiveWindowMessages.Export, cellContents);
        return arg.prevState;
    }

    export function save(arg: NativeEditorReducerArg): IMainState {
        // Note: this is assuming editor contents have already been saved. That should happen as a result of focus change

        // Actually waiting for save results before marking as not dirty, so don't do it here.
        arg.postMessage(InteractiveWindowMessages.SaveAll, { cells: arg.prevState.cellVMs.map(cvm => cvm.cell) });
        return arg.prevState;
    }

    export function showDataViewer(arg: NativeEditorReducerArg<IShowDataViewerAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.ShowDataViewer, { variableName: arg.payload.variableName, columnSize: arg.payload.columnSize });
        return arg.prevState;
    }

    export function sendCommand(arg: NativeEditorReducerArg<ISendCommandAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.NativeCommand, { command: arg.payload.command, source: arg.payload.commandType })
        return arg.prevState;
    }

    export function showPlot(arg: NativeEditorReducerArg<IShowPlotAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.NativeCommand, arg.payload.imageHtml);
        return arg.prevState;
    }

    export function openLink(arg: NativeEditorReducerArg<IOpenLinkAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.OpenLink, arg.payload.uri.toString());
        return arg.prevState;
    }
}
