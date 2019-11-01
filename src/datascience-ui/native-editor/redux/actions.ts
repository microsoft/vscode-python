// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Action } from 'redux';
import { CursorPos } from '../../interactive-common/mainState';
import { IShowDataViewer, InteractiveWindowMessages, NativeCommandType } from '../../../client/datascience/interactive-common/interactiveWindowTypes';

/**
 * How to add a new state change:
 * 1) Add a new action.<name> to NativeEditorActionTypes
 * 2) Add a new interface (or reuse 1 below) if the action takes any parameters (ex: ICellAction)
 * 3) Add a new actionCreator function (this is how you use it from a react control). The creator should 'create' an instance of the action.
 * 4) Add an entry into the INativeEditorActionMapping in mapping.ts. This is how the type of the list of reducers is enforced.
 * 5) Add a new handler for the action under the 'reducer's folder. Handle the expected state change
 * 6) Add the handler to the main reducer map in reducers\index.ts
 */

export enum NativeEditorActionTypes {
    INSERT_ABOVE = 'action.insert_above',
    INSERT_BELOW = 'action.insert_below',
    INSERT_ABOVE_FIRST = 'action.insert_above_first',
    FOCUS_CELL = 'action.focus_cell',
    ADD_NEW_CELL = 'action.add_new_cell',
    EXECUTE_CELL = 'action.execute_cell',
    EXECUTE_ALL_CELLS = 'action.execute_all_cells',
    TOGGLE_VARIABLE_EXPLORER = 'action.toggle_variable_explorer',
    REFRESH_VARIABLES = 'action.refresh_variables',
    RESTART_KERNEL = 'action.restart_kernel',
    INTERRUPT_KERNEL = 'action.interrupt_kernel',
    CLEAR_ALL_OUTPUTS = 'action.clear_all_outputs',
    EXPORT = 'action.export',
    SAVE = 'action.save',
    SHOW_DATA_VIEWER = 'action.show_data_viewer',
    SEND_COMMAND = 'action.send_command',
    SELECT_CELL = 'action.select_cell'
}

export interface ICellAction {
    cellId: string | undefined;
}

export interface IFocusCell {
    cellId: string | undefined;
    cursorPos: CursorPos;
}

export interface IExecuteAction extends ICellAction {
    code: string;
}

export interface IExecuteAllAction {
    codes: string[];
}

export interface IRefreshVariablesAction {
    newExecutionCount?: number;
}

export interface IShowDataViewerAction extends IShowDataViewer {
}

export interface ISendCommandAction {
    commandType: 'mouse' | 'keyboard';
    command: NativeCommandType;
}

type NativeEditorAction = Action<NativeEditorActionTypes>;

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    insertAbove: (cellId: string | undefined): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.INSERT_ABOVE, cellId }),
    insertAboveFirst: (): NativeEditorAction => ({ type: NativeEditorActionTypes.INSERT_ABOVE_FIRST }),
    insertBelow: (cellId: string | undefined): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.INSERT_BELOW, cellId }),
    focusCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): NativeEditorAction & IFocusCell => ({ type: NativeEditorActionTypes.FOCUS_CELL, cellId, cursorPos }),
    selectCell: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.SELECT_CELL, cellId }),
    addCell: (): NativeEditorAction => ({ type: NativeEditorActionTypes.ADD_NEW_CELL }),
    executeCell: (cellId: string, code: string): NativeEditorAction & IExecuteAction => ({ type: NativeEditorActionTypes.EXECUTE_CELL, cellId, code }),
    executeAllCells: (codes: string[]): NativeEditorAction & IExecuteAllAction => ({ type: NativeEditorActionTypes.EXECUTE_ALL_CELLS, codes }),
    toggleVariableExplorer: (): NativeEditorAction => ({ type: NativeEditorActionTypes.TOGGLE_VARIABLE_EXPLORER }),
    refreshVariables: (newExecutionCount?: number): NativeEditorAction & IRefreshVariablesAction => ({ type: NativeEditorActionTypes.REFRESH_VARIABLES, newExecutionCount }),
    restartKernel: (): NativeEditorAction => ({ type: NativeEditorActionTypes.RESTART_KERNEL }),
    interruptKernel: (): NativeEditorAction => ({ type: NativeEditorActionTypes.INTERRUPT_KERNEL }),
    clearAllOutputs: (): NativeEditorAction => ({ type: NativeEditorActionTypes.CLEAR_ALL_OUTPUTS }),
    export: (): NativeEditorAction => ({ type: NativeEditorActionTypes.EXPORT }),
    save: (): NativeEditorAction => ({ type: NativeEditorActionTypes.SAVE }),
    showDataViewer: (variableName: string, columnSize: number): NativeEditorAction & IShowDataViewerAction => ({ type: NativeEditorActionTypes.SHOW_DATA_VIEWER, variableName, columnSize }),
    sendCommand: (command: NativeCommandType, commandType: 'mouse' | 'keyboard') => ({ type: NativeEditorActionTypes.SEND_COMMAND, command, commandType })
};
