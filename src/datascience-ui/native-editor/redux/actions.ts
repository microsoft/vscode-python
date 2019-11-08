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
    IOpenLinkAction,
    IRefreshVariablesAction,
    IShowDataViewerAction,
    IShowPlotAction
} from '../../interactive-common/redux/reducers/types';

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    insertAbove: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.INSERT_ABOVE, payload: { cellId } }),
    insertAboveFirst: (): CommonAction<never | undefined> => ({ type: CommonActionType.INSERT_ABOVE_FIRST }),
    insertBelow: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.INSERT_BELOW, payload: { cellId } }),
    focusCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> => ({ type: CommonActionType.FOCUS_CELL, payload: { cellId, cursorPos } }),
    unfocusCell: (cellId: string, code: string): CommonAction<ICodeAction> => ({ type: CommonActionType.UNFOCUS_CELL, payload: { cellId, code } }),
    selectCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> => ({ type: CommonActionType.SELECT_CELL, payload: { cellId, cursorPos } }),
    selectNextCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.SELECT_NEXT_CELL, payload: { cellId } }),
    addCell: (): CommonAction<never | undefined> => ({ type: CommonActionType.ADD_NEW_CELL }),
    executeCell: (cellId: string, code: string): CommonAction<ICodeAction> => ({ type: CommonActionType.EXECUTE_CELL, payload: { cellId, code } }),
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
    showDataViewer: (variableName: string, columnSize: number): CommonAction<IShowDataViewerAction> => ({ type: CommonActionType.SHOW_DATA_VIEWER, payload: { variableName, columnSize } }),
    sendCommand: (command: NativeCommandType, commandType: 'mouse' | 'keyboard') => ({ type: CommonActionType.SEND_COMMAND, command, commandType }),
    moveCellUp: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.MOVE_CELL_UP, payload: { cellId } }),
    moveCellDown: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.MOVE_CELL_DOWN, payload: { cellId } }),
    changeCellType: (cellId: string, currentCode: string): CommonAction<IChangeCellTypeAction> => ({ type: CommonActionType.CHANGE_CELL_TYPE, payload: { cellId, currentCode } }),
    toggleLineNumbers: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.TOGGLE_LINE_NUMBERS, payload: { cellId } }),
    toggleOutput: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.TOGGLE_OUTPUT, payload: { cellId } }),
    deleteCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.DELETE_CELL, payload: { cellId } }),
    undo: (): CommonAction<never | undefined> => ({ type: CommonActionType.UNDO }),
    arrowUp: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.ARROW_UP, payload: { cellId } }),
    arrowDown: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.ARROW_DOWN, payload: { cellId } }),
    editCell: (cellId: string, changes: monacoEditor.editor.IModelContentChange[], modelId: string): CommonAction<IEditCellAction> => ({ type: CommonActionType.EDIT_CELL, payload: { cellId, changes, modelId } }),
    openLink: (uri: monacoEditor.Uri): CommonAction<IOpenLinkAction> => ({ type: CommonActionType.OPEN_LINK, payload: { uri } }),
    showPlot: (imageHtml: string): CommonAction<IShowPlotAction> => ({ type: CommonActionType.SHOW_PLOT, payload: { imageHtml } }),
    gatherCell: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.GATHER_CELL, payload: { cellId } }),
    editorLoaded: (): CommonAction<never | undefined> => ({ type: CommonActionType.EDITOR_LOADED }),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> => ({ type: CommonActionType.CODE_CREATED, payload: { cellId, modelId } }),
    loadedAllCells: (): CommonAction<never | undefined> => ({ type: CommonActionType.LOADED_ALL_CELLS })
};
