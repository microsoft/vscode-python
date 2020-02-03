// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { InteractiveWindowMessages, IShowDataViewer, NativeCommandType } from '../../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../../client/datascience/interactive-common/types';
import { IJupyterVariablesRequest } from '../../../../client/datascience/types';
import { ActionWithPayload, ReducerArg } from '../../../react-common/reduxUtils';
import { CursorPos, IMainState } from '../../mainState';

/**
 * How to add a new state change:
 * 1) Add a new <name> to CommonActionType (preferably `InteractiveWindowMessages` - to keep messages in the same place).
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
    CLICK_CELL = 'action.click_cell',
    CODE_CREATED = 'action.code_created',
    COPY_CELL_CODE = 'action.copy_cell_code',
    DESELECT_CELL = 'action.deselect_cell',
    DOUBLE_CLICK_CELL = 'action.double_click_cell',
    EDITOR_LOADED = 'action.editor_loaded',
    EDIT_CELL = 'action.edit_cell',
    EXECUTE_ABOVE = 'action.execute_above',
    EXECUTE_ALL_CELLS = 'action.execute_all_cells',
    EXECUTE_CELL = 'action.execute_cell',
    EXECUTE_CELL_AND_BELOW = 'action.execute_cell_and_below',
    EXPORT = 'action.export',
    FOCUS_CELL = 'action.focus_cell',
    GATHER_CELL = 'action.gather_cell',
    GET_VARIABLE_DATA = 'action.get_variable_data',
    GOTO_CELL = 'action.goto_cell',
    INSERT_ABOVE = 'action.insert_above',
    INSERT_ABOVE_FIRST = 'action.insert_above_first',
    INSERT_BELOW = 'action.insert_below',
    INTERRUPT_KERNEL = 'action.interrupt_kernel_action',
    LOADED_ALL_CELLS = 'action.loaded_all_cells',
    LINK_CLICK = 'action.link_click',
    MOVE_CELL_DOWN = 'action.move_cell_down',
    MOVE_CELL_UP = 'action.move_cell_up',
    PostOutgoingMessage = 'action.postOutgoingMessage',
    REFRESH_VARIABLES = 'action.refresh_variables',
    RESTART_KERNEL = 'action.restart_kernel_action',
    SAVE = 'action.save',
    SCROLL = 'action.scroll',
    SELECT_CELL = 'action.select_cell',
    SELECT_SERVER = 'action.select_server',
    SEND_COMMAND = 'action.send_command',
    SHOW_DATA_VIEWER = 'action.show_data_viewer',
    SUBMIT_INPUT = 'action.submit_input',
    TOGGLE_INPUT_BLOCK = 'action.toggle_input_block',
    TOGGLE_LINE_NUMBERS = 'action.toggle_line_numbers',
    TOGGLE_OUTPUT = 'action.toggle_output',
    TOGGLE_VARIABLE_EXPLORER = 'action.toggle_variable_explorer',
    UNFOCUS_CELL = 'action.unfocus_cell',
    UNMOUNT = 'action.unmount'
}

export type CommonActionTypeMapping = {
    [CommonActionType.INSERT_ABOVE]: ICellAction & IAddCellAction;
    [CommonActionType.INSERT_BELOW]: ICellAction & IAddCellAction;
    [CommonActionType.INSERT_ABOVE_FIRST]: IAddCellAction;
    [CommonActionType.FOCUS_CELL]: ICellAndCursorAction;
    [CommonActionType.UNFOCUS_CELL]: ICodeAction;
    [CommonActionType.ADD_NEW_CELL]: IAddCellAction;
    [CommonActionType.EDIT_CELL]: IEditCellAction;
    [CommonActionType.EXECUTE_CELL]: IExecuteAction;
    [CommonActionType.EXECUTE_ALL_CELLS]: never | undefined;
    [CommonActionType.EXECUTE_ABOVE]: ICellAction;
    [CommonActionType.EXECUTE_CELL_AND_BELOW]: ICodeAction;
    [CommonActionType.RESTART_KERNEL]: never | undefined;
    [CommonActionType.INTERRUPT_KERNEL]: never | undefined;
    [CommonActionType.EXPORT]: never | undefined;
    [CommonActionType.SAVE]: never | undefined;
    [CommonActionType.SHOW_DATA_VIEWER]: IShowDataViewerAction;
    [CommonActionType.SEND_COMMAND]: ISendCommandAction;
    [CommonActionType.SELECT_CELL]: ICellAndCursorAction;
    [CommonActionType.MOVE_CELL_UP]: ICellAction;
    [CommonActionType.MOVE_CELL_DOWN]: ICellAction;
    [CommonActionType.TOGGLE_LINE_NUMBERS]: ICellAction;
    [CommonActionType.TOGGLE_OUTPUT]: ICellAction;
    [CommonActionType.ARROW_UP]: ICodeAction;
    [CommonActionType.ARROW_DOWN]: ICodeAction;
    [CommonActionType.CHANGE_CELL_TYPE]: IChangeCellTypeAction;
    [CommonActionType.LINK_CLICK]: ILinkClickAction;
    [CommonActionType.GOTO_CELL]: ICellAction;
    [CommonActionType.TOGGLE_INPUT_BLOCK]: ICellAction;
    [CommonActionType.SUBMIT_INPUT]: ICodeAction;
    [CommonActionType.SCROLL]: IScrollAction;
    [CommonActionType.CLICK_CELL]: ICellAction;
    [CommonActionType.COPY_CELL_CODE]: ICellAction;
    [CommonActionType.GATHER_CELL]: ICellAction;
    [CommonActionType.EDITOR_LOADED]: never | undefined;
    [CommonActionType.LOADED_ALL_CELLS]: never | undefined;
    [CommonActionType.UNMOUNT]: never | undefined;
    [CommonActionType.SELECT_SERVER]: never | undefined;
    [CommonActionType.CODE_CREATED]: ICodeCreatedAction;
    [CommonActionType.GET_VARIABLE_DATA]: IJupyterVariablesRequest;
    [CommonActionType.TOGGLE_VARIABLE_EXPLORER]: never | undefined;
};

export interface IShowDataViewerAction extends IShowDataViewer {}

export interface ILinkClickAction {
    href: string;
}

export interface IScrollAction {
    isAtBottom: boolean;
}

// tslint:disable-next-line: no-any
export type CommonReducerArg<AT = CommonActionType | InteractiveWindowMessages, T = never | undefined> = ReducerArg<IMainState, AT, BaseReduxActionPayload<T>>;

export interface ICellAction {
    cellId: string | undefined;
}

export interface IAddCellAction {
    /**
     * Id of the new cell that is to be added.
     * If none provided, then generate a new id.
     */
    newCellId: string;
}

export interface ICodeAction extends ICellAction {
    code: string;
}

export interface IEditCellAction extends ICodeAction {
    changes: monacoEditor.editor.IModelContentChange[];
    modelId: string;
}

// I.e. when using the operation `add`, we need the corresponding `IAddCellAction`.
// They are mutually exclusive, if not `add`, then there's no `newCellId`.
export type IExecuteAction =
    | (ICodeAction & {
          moveOp: 'select' | 'none';
      })
    | (ICodeAction &
          IAddCellAction & {
              moveOp: 'add';
          });

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
export type CommonAction<T = never | undefined> = ActionWithPayload<T, CommonActionType | InteractiveWindowMessages>;

export function createIncomingActionWithPayload<T>(type: CommonActionType | InteractiveWindowMessages, data: T): CommonAction<T> {
    // tslint:disable-next-line: no-any
    return { type, payload: ({ data, messageDirection: 'incoming' } as any) as BaseReduxActionPayload<T> };
}
export function createIncomingAction(type: CommonActionType | InteractiveWindowMessages): CommonAction {
    return { type, payload: { messageDirection: 'incoming', data: undefined } };
}
