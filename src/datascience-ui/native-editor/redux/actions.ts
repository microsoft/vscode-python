// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { NativeCommandType } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CursorPos } from '../../interactive-common/mainState';
import {
    CommonAction,
    CommonActionType,
    ICellAction,
    ICellAndCursorAction,
    IChangeCellTypeAction,
    ICodeAction,
    ICodeCreatedAction,
    IEditCellAction,
    IExecuteAction,
    ILinkClickAction,
    IRefreshVariablesAction,
    ISendCommandAction,
    IShowDataViewerAction,
    IShowPlotAction
} from '../../interactive-common/redux/reducers/types';

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    insertAbove: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.INSERT_ABOVE, payload: { cellId } }),
    insertAboveFirst: (): CommonAction<never | undefined> => ({ type: CommonActionType.INSERT_ABOVE_FIRST }),
    insertBelow: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.INSERT_BELOW, payload: { cellId } }),
    focusCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> => ({
        type: CommonActionType.FOCUS_CELL,
        payload: { cellId, cursorPos }
    }),
    unfocusCell: (cellId: string, code: string): CommonAction<ICodeAction> => ({ type: CommonActionType.UNFOCUS_CELL, payload: { cellId, code } }),
    selectCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> => ({
        type: CommonActionType.SELECT_CELL,
        payload: { cellId, cursorPos }
    }),
    addCell: (): CommonAction<never | undefined> => ({ type: CommonActionType.ADD_NEW_CELL }),
    executeCell: (cellId: string, code: string, moveOp: 'add' | 'select' | 'none'): CommonAction<IExecuteAction> => ({
        type: CommonActionType.EXECUTE_CELL,
        payload: { cellId, code, moveOp }
    }),
    executeAllCells: (): CommonAction<never | undefined> => ({ type: CommonActionType.EXECUTE_ALL_CELLS }),
    executeAbove: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.EXECUTE_ABOVE, payload: { cellId } }),
    executeCellAndBelow: (cellId: string, code: string): CommonAction<ICodeAction> => ({ type: CommonActionType.EXECUTE_CELL_AND_BELOW, payload: { cellId, code } }),
    toggleVariableExplorer: (): CommonAction<never | undefined> => ({ type: CommonActionType.TOGGLE_VARIABLE_EXPLORER }),
    refreshVariables: (newExecutionCount?: number): CommonAction<IRefreshVariablesAction> => ({ type: CommonActionType.REFRESH_VARIABLES, payload: { newExecutionCount } }),
    restartKernel: (): CommonAction<never | undefined> => ({ type: CommonActionType.RESTART_KERNEL }),
    interruptKernel: (): CommonAction<never | undefined> => ({ type: CommonActionType.INTERRUPT_KERNEL }),
    clearAllOutputs: (): CommonAction<never | undefined> => ({ type: CommonActionType.CLEAR_ALL_OUTPUTS }),
    export: (): CommonAction<never | undefined> => ({ type: CommonActionType.EXPORT }),
    save: (): CommonAction<never | undefined> => ({ type: CommonActionType.SAVE }),
    showDataViewer: (variableName: string, columnSize: number): CommonAction<IShowDataViewerAction> => ({
        type: CommonActionType.SHOW_DATA_VIEWER,
        payload: { variableName, columnSize }
    }),
    sendCommand: (command: NativeCommandType, commandType: 'mouse' | 'keyboard'): CommonAction<ISendCommandAction> => ({
        type: CommonActionType.SEND_COMMAND,
        payload: { command, commandType }
    }),
    moveCellUp: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.MOVE_CELL_UP, payload: { cellId } }),
    moveCellDown: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.MOVE_CELL_DOWN, payload: { cellId } }),
    changeCellType: (cellId: string, currentCode: string): CommonAction<IChangeCellTypeAction> => ({ type: CommonActionType.CHANGE_CELL_TYPE, payload: { cellId, currentCode } }),
    toggleLineNumbers: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.TOGGLE_LINE_NUMBERS, payload: { cellId } }),
    toggleOutput: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.TOGGLE_OUTPUT, payload: { cellId } }),
    deleteCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.DELETE_CELL, payload: { cellId } }),
    undo: (): CommonAction<never | undefined> => ({ type: CommonActionType.UNDO }),
    redo: (): CommonAction<never | undefined> => ({ type: CommonActionType.REDO }),
    arrowUp: (cellId: string, code: string): CommonAction<ICodeAction> => ({ type: CommonActionType.ARROW_UP, payload: { cellId, code } }),
    arrowDown: (cellId: string, code: string): CommonAction<ICodeAction> => ({ type: CommonActionType.ARROW_DOWN, payload: { cellId, code } }),
    editCell: (cellId: string, changes: monacoEditor.editor.IModelContentChange[], modelId: string): CommonAction<IEditCellAction> => ({
        type: CommonActionType.EDIT_CELL,
        payload: { cellId, changes, modelId }
    }),
    linkClick: (href: string): CommonAction<ILinkClickAction> => ({ type: CommonActionType.LINK_CLICK, payload: { href } }),
    showPlot: (imageHtml: string): CommonAction<IShowPlotAction> => ({ type: CommonActionType.SHOW_PLOT, payload: { imageHtml } }),
    gatherCell: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.GATHER_CELL, payload: { cellId } }),
    editorLoaded: (): CommonAction<never | undefined> => ({ type: CommonActionType.EDITOR_LOADED }),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> => ({ type: CommonActionType.CODE_CREATED, payload: { cellId, modelId } }),
    loadedAllCells: (): CommonAction<never | undefined> => ({ type: CommonActionType.LOADED_ALL_CELLS }),
    editorUnmounted: (): CommonAction<never | undefined> => ({ type: CommonActionType.UNMOUNT }),
    selectKernel: (): CommonAction<never | undefined> => ({ type: CommonActionType.SELECT_KERNEL }),
    selectServer: (): CommonAction<never | undefined> => ({ type: CommonActionType.SELECT_SERVER })
};
