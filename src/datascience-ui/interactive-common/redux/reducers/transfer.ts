// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { InteractiveWindowMessages } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IMainState } from '../../mainState';
import { ISendCommandAction, IShowDataViewerAction, IShowPlotAction, IOpenLinkAction } from '../../../native-editor/redux/actions';
import { CommonReducerArg } from './types';

// These are all reducers that don't actually change state. They merely dispatch a message to the other side.
export namespace Transfer {
    export function exportCells<T>(arg: CommonReducerArg<T>): IMainState {
        const cellContents = arg.prevState.cellVMs.map(v => v.cell);
        arg.postMessage(InteractiveWindowMessages.Export, cellContents);
        return arg.prevState;
    }

    export function save<T>(arg: CommonReducerArg<T>): IMainState {
        // Note: this is assuming editor contents have already been saved. That should happen as a result of focus change

        // Actually waiting for save results before marking as not dirty, so don't do it here.
        arg.postMessage(InteractiveWindowMessages.SaveAll, { cells: arg.prevState.cellVMs.map(cvm => cvm.cell) });
        return arg.prevState;
    }

    export function showDataViewer<T>(arg: CommonReducerArg<T, IShowDataViewerAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.ShowDataViewer, { variableName: arg.payload.variableName, columnSize: arg.payload.columnSize });
        return arg.prevState;
    }

    export function sendCommand<T>(arg: CommonReducerArg<T, ISendCommandAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.NativeCommand, { command: arg.payload.command, source: arg.payload.commandType })
        return arg.prevState;
    }

    export function showPlot<T>(arg: CommonReducerArg<T, IShowPlotAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.NativeCommand, arg.payload.imageHtml);
        return arg.prevState;
    }

    export function openLink<T>(arg: CommonReducerArg<T, IOpenLinkAction>): IMainState {
        arg.postMessage(InteractiveWindowMessages.OpenLink, arg.payload.uri.toString());
        return arg.prevState;
    }

    export function getAllCells<T>(arg: CommonReducerArg<T>): IMainState {
        const cells = arg.prevState.cellVMs.map(c => c.cell);
        arg.postMessage(InteractiveWindowMessages.ReturnAllCells, cells);
        return arg.prevState;
    }
}
