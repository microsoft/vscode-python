// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { IShowDataViewer, NativeCommandType } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { ActionWithPayload, ReducerArg } from '../../../react-common/reduxUtils';
import { CursorPos, IMainState } from '../../mainState';

/**
 * How to add a new state change:
 * 1) Add a new action.<name> to CommonActionType
 * 2) Add a new interface (or reuse 1 below) if the action takes any parameters (ex: ICellAction)
 * 3) Add a new actionCreator function (this is how you use it from a react control) to the
 *    appropriate actionCreator list (one for native and one for interactive).
 *    The creator should 'create' an instance of the action.
 * 4) Add an entry into the appropriate mapping.ts. This is how the type of the list of reducers is enforced.
 * 5) Add a new handler for the action under the 'reducer's folder. Handle the expected state change
 * 6) Add the handler to the main reducer map in reducers\index.ts
 */

export enum CommonActionType {
    ADD_NEW_CELL = 'action.add_new_cell',
    ARROW_DOWN = 'action.arrow_down',
    ARROW_UP = 'action.arrow_up',
    CHANGE_CELL_TYPE = 'action.change_cell_type',
    CLEAR_ALL_OUTPUTS = 'action.clear_all_outputs',
    CLICK_CELL = 'action.click_cell',
    CODE_CREATED = 'action.code_created',
    COLLAPSE_ALL = 'action.collapse_all',
    COPY_CELL_CODE = 'action.copy_cell_code',
    DELETE_ALL_CELLS = 'action.delete_all_cells',
    DELETE_CELL = 'action.delete_cell',
    DOUBLE_CLICK_CELL = 'action.double_click_cell',
    EDITOR_LOADED = 'action.editor_loaded',
    EDIT_CELL = 'action.edit_cell',
    EXECUTE_ABOVE = 'action.execute_above',
    EXECUTE_ALL_CELLS = 'action.execute_all_cells',
    EXECUTE_CELL = 'action.execute_cell',
    EXECUTE_CELL_AND_BELOW = 'action.execute_cell_and_below',
    EXPAND_ALL = 'action.expand_all',
    EXPORT = 'action.export',
    FOCUS_CELL = 'action.focus_cell',
    GATHER_CELL = 'action.gather_cell',
    GOTO_CELL = 'action.goto_cell',
    INSERT_ABOVE = 'action.insert_above',
    INSERT_ABOVE_FIRST = 'action.insert_above_first',
    INSERT_BELOW = 'action.insert_below',
    INTERRUPT_KERNEL = 'action.interrupt_kernel_action',
    LOADED_ALL_CELLS = 'action.loaded_all_cells',
    LINK_CLICK = 'action.link_click',
    MOVE_CELL_DOWN = 'action.move_cell_down',
    MOVE_CELL_UP = 'action.move_cell_up',
    REDO = 'action.redo',
    REFRESH_VARIABLES = 'action.refresh_variables',
    RESTART_KERNEL = 'action.restart_kernel_action',
    SAVE = 'action.save',
    SCROLL = 'action.scroll',
    SELECT_CELL = 'action.select_cell',
    SELECT_KERNEL = 'action.select_kernel',
    SELECT_SERVER = 'action.select_server',
    SEND_COMMAND = 'action.send_command',
    SHOW_DATA_VIEWER = 'action.show_data_viewer',
    SHOW_PLOT = 'action.show_plot',
    START_CELL = 'action.start_cell',
    SUBMIT_INPUT = 'action.submit_input',
    TOGGLE_INPUT_BLOCK = 'action.toggle_input_block',
    TOGGLE_LINE_NUMBERS = 'action.toggle_line_numbers',
    TOGGLE_OUTPUT = 'action.toggle_output',
    TOGGLE_VARIABLE_EXPLORER = 'action.toggle_variable_explorer',
    UNDO = 'action.undo',
    UNFOCUS_CELL = 'action.unfocus_cell',
    UNMOUNT = 'action.unmount'
}

export interface IShowDataViewerAction extends IShowDataViewer {}

export interface ILinkClickAction {
    href: string;
}

export interface IShowPlotAction {
    imageHtml: string;
}

export interface IScrollAction {
    isAtBottom: boolean;
}
export type CommonReducerArg<AT, T = never | undefined> = ReducerArg<IMainState, AT, T>;

export interface ICellAction {
    cellId: string | undefined;
}

export interface IEditCellAction extends ICellAction {
    changes: monacoEditor.editor.IModelContentChange[];
    modelId: string;
}

export interface ICodeAction extends ICellAction {
    code: string;
}

export interface IExecuteAction extends ICodeAction {
    moveOp: 'add' | 'select' | 'none';
}

export interface ICodeCreatedAction extends ICellAction {
    modelId: string;
}

export interface ICellAndCursorAction extends ICellAction {
    cursorPos: CursorPos;
}

export interface IRefreshVariablesAction {
    newExecutionCount?: number;
}

export interface IShowDataViewerAction extends IShowDataViewer {}

export interface ISendCommandAction {
    commandType: 'mouse' | 'keyboard';
    command: NativeCommandType;
}

export interface IChangeCellTypeAction {
    cellId: string;
    currentCode: string;
}
export type CommonAction<T> = ActionWithPayload<T, CommonActionType>;
