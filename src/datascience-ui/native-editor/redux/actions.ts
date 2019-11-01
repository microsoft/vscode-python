// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Action } from 'redux';

import { IShowDataViewer, NativeCommandType } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CursorPos } from '../../interactive-common/mainState';

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
    UNFOCUS_CELL = 'action.unfocus_cell',
    ADD_NEW_CELL = 'action.add_new_cell',
    EXECUTE_CELL = 'action.execute_cell',
    EXECUTE_ALL_CELLS = 'action.execute_all_cells',
    EXECUTE_ABOVE = 'action.execute_above',
    EXECUTE_CELL_AND_BELOW = 'action.execute_cell_and_below',
    TOGGLE_VARIABLE_EXPLORER = 'action.toggle_variable_explorer',
    REFRESH_VARIABLES = 'action.refresh_variables',
    RESTART_KERNEL = 'action.restart_kernel',
    INTERRUPT_KERNEL = 'action.interrupt_kernel',
    CLEAR_ALL_OUTPUTS = 'action.clear_all_outputs',
    EXPORT = 'action.export',
    SAVE = 'action.save',
    SHOW_DATA_VIEWER = 'action.show_data_viewer',
    SEND_COMMAND = 'action.send_command',
    SELECT_CELL = 'action.select_cell',
    SELECT_NEXT_CELL = 'action.select_next_cell',
    MOVE_CELL_UP = 'action.move_cell_up',
    MOVE_CELL_DOWN = 'action.move_cell_down',
    CHANGE_CELL_TYPE = 'action.change_cell_type',
    TOGGLE_LINE_NUMBERS = 'action.toggle_line_numbers',
    TOGGLE_OUTPUT = 'action.toggle_output',
    DELETE_CELL = 'action.delete_cell',
    UNDO = 'action.undo',
    ARROW_UP = 'action.arrow_up',
    ARROW_DOWN = 'action.arrow_down',
    EDIT_CELL = 'action.edit_cell'
}

export interface ICellAction {
    cellId: string | undefined;
}

export interface IEditCellAction extends ICellAction {
    changes: monacoEditor.editor.IModelContentChange[];
}

export interface ICellAndCursorAction extends ICellAction {
    cursorPos: CursorPos;
}

export interface ICodeAction extends ICellAction {
    code: string;
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

export interface IChangeCellTypeAction {
    cellId: string;
    currentCode: string;
}

type NativeEditorAction = Action<NativeEditorActionTypes>;

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    insertAbove: (cellId: string | undefined): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.INSERT_ABOVE, cellId }),
    insertAboveFirst: (): NativeEditorAction => ({ type: NativeEditorActionTypes.INSERT_ABOVE_FIRST }),
    insertBelow: (cellId: string | undefined): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.INSERT_BELOW, cellId }),
    focusCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): NativeEditorAction & ICellAndCursorAction => ({ type: NativeEditorActionTypes.FOCUS_CELL, cellId, cursorPos }),
    unfocusCell: (cellId: string, code: string): NativeEditorAction & ICodeAction => ({ type: NativeEditorActionTypes.UNFOCUS_CELL, cellId, code }),
    selectCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): NativeEditorAction & ICellAndCursorAction => ({ type: NativeEditorActionTypes.SELECT_CELL, cellId, cursorPos }),
    selectNextCell: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.SELECT_NEXT_CELL, cellId }),
    addCell: (): NativeEditorAction => ({ type: NativeEditorActionTypes.ADD_NEW_CELL }),
    executeCell: (cellId: string, code: string): NativeEditorAction & ICodeAction => ({ type: NativeEditorActionTypes.EXECUTE_CELL, cellId, code }),
    executeAllCells: (): NativeEditorAction => ({ type: NativeEditorActionTypes.EXECUTE_ALL_CELLS }),
    executeAbove: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.EXECUTE_ABOVE, cellId }),
    executeCellAndBelow: (cellId: string, code: string): NativeEditorAction & ICodeAction => ({ type: NativeEditorActionTypes.EXECUTE_CELL_AND_BELOW, cellId, code }),
    toggleVariableExplorer: (): NativeEditorAction => ({ type: NativeEditorActionTypes.TOGGLE_VARIABLE_EXPLORER }),
    refreshVariables: (newExecutionCount?: number): NativeEditorAction & IRefreshVariablesAction => ({ type: NativeEditorActionTypes.REFRESH_VARIABLES, newExecutionCount }),
    restartKernel: (): NativeEditorAction => ({ type: NativeEditorActionTypes.RESTART_KERNEL }),
    interruptKernel: (): NativeEditorAction => ({ type: NativeEditorActionTypes.INTERRUPT_KERNEL }),
    clearAllOutputs: (): NativeEditorAction => ({ type: NativeEditorActionTypes.CLEAR_ALL_OUTPUTS }),
    export: (): NativeEditorAction => ({ type: NativeEditorActionTypes.EXPORT }),
    save: (): NativeEditorAction => ({ type: NativeEditorActionTypes.SAVE }),
    showDataViewer: (variableName: string, columnSize: number): NativeEditorAction & IShowDataViewerAction => ({ type: NativeEditorActionTypes.SHOW_DATA_VIEWER, variableName, columnSize }),
    sendCommand: (command: NativeCommandType, commandType: 'mouse' | 'keyboard') => ({ type: NativeEditorActionTypes.SEND_COMMAND, command, commandType }),
    moveCellUp: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.MOVE_CELL_UP, cellId }),
    moveCellDown: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.MOVE_CELL_DOWN, cellId }),
    changeCellType: (cellId: string, currentCode: string): NativeEditorAction & IChangeCellTypeAction => ({ type: NativeEditorActionTypes.CHANGE_CELL_TYPE, cellId, currentCode }),
    toggleLineNumbers: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.TOGGLE_LINE_NUMBERS, cellId }),
    toggleOutput: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.TOGGLE_OUTPUT, cellId }),
    deleteCell: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.DELETE_CELL, cellId }),
    undo: (): NativeEditorAction => ({ type: NativeEditorActionTypes.UNDO }),
    arrowUp: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.ARROW_UP, cellId }),
    arrowDown: (cellId: string): NativeEditorAction & ICellAction => ({ type: NativeEditorActionTypes.ARROW_DOWN, cellId }),
    editCell: (cellId: string, changes: monacoEditor.editor.IModelContentChange[]): NativeEditorAction & IEditCellAction => ({ type: NativeEditorActionTypes.EDIT_CELL, cellId, changes })
};
