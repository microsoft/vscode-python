// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as uuid from 'uuid/v4';
import { InteractiveWindowMessages, NativeCommandType } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable, IJupyterVariablesRequest } from '../../../client/datascience/types';
import { CursorPos } from '../../interactive-common/mainState';
import {
    CommonAction,
    CommonActionType,
    createIncomingAction,
    createIncomingActionWithPayload,
    IAddCellAction,
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
    IShowDataViewerAction
} from '../../interactive-common/redux/reducers/types';

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    insertAbove: (cellId: string | undefined): CommonAction<ICellAction & IAddCellAction> =>
        createIncomingActionWithPayload(CommonActionType.INSERT_ABOVE, { cellId, newCellId: uuid() }),
    insertAboveFirst: (): CommonAction<IAddCellAction> => createIncomingActionWithPayload(CommonActionType.INSERT_ABOVE_FIRST, { newCellId: uuid() }),
    insertBelow: (cellId: string | undefined): CommonAction<ICellAction & IAddCellAction> =>
        createIncomingActionWithPayload(CommonActionType.INSERT_BELOW, { cellId, newCellId: uuid() }),
    focusCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> =>
        createIncomingActionWithPayload(CommonActionType.FOCUS_CELL, { cellId, cursorPos }),
    unfocusCell: (cellId: string, code: string): CommonAction<ICodeAction> => createIncomingActionWithPayload(CommonActionType.UNFOCUS_CELL, { cellId, code }),
    selectCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> =>
        createIncomingActionWithPayload(CommonActionType.SELECT_CELL, { cellId, cursorPos }),
    addCell: (): CommonAction<IAddCellAction> => createIncomingActionWithPayload(CommonActionType.ADD_NEW_CELL, { newCellId: uuid() }),
    executeCell: (cellId: string, code: string, moveOp: 'add' | 'select' | 'none'): CommonAction<IExecuteAction> => {
        if (moveOp === 'add') {
            return createIncomingActionWithPayload(CommonActionType.EXECUTE_CELL, { cellId, code, moveOp, newCellId: uuid() });
        } else {
            return createIncomingActionWithPayload(CommonActionType.EXECUTE_CELL, { cellId, code, moveOp });
        }
    },
    executeAllCells: (): CommonAction => createIncomingAction(CommonActionType.EXECUTE_ALL_CELLS),
    executeAbove: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.EXECUTE_ABOVE, { cellId }),
    executeCellAndBelow: (cellId: string, code: string): CommonAction<ICodeAction> => createIncomingActionWithPayload(CommonActionType.EXECUTE_CELL_AND_BELOW, { cellId, code }),
    toggleVariableExplorer: (): CommonAction => createIncomingAction(CommonActionType.TOGGLE_VARIABLE_EXPLORER),
    refreshVariables: (newExecutionCount?: number): CommonAction<IRefreshVariablesAction> =>
        createIncomingActionWithPayload(CommonActionType.REFRESH_VARIABLES, { newExecutionCount }),
    restartKernel: (): CommonAction => createIncomingAction(CommonActionType.RESTART_KERNEL),
    interruptKernel: (): CommonAction => createIncomingAction(CommonActionType.INTERRUPT_KERNEL),
    clearAllOutputs: (): CommonAction => createIncomingAction(InteractiveWindowMessages.ClearAllOutputs),
    export: (): CommonAction => createIncomingAction(CommonActionType.EXPORT),
    save: (): CommonAction => createIncomingAction(CommonActionType.SAVE),
    showDataViewer: (variable: IJupyterVariable, columnSize: number): CommonAction<IShowDataViewerAction> =>
        createIncomingActionWithPayload(CommonActionType.SHOW_DATA_VIEWER, { variable, columnSize }),
    sendCommand: (command: NativeCommandType, commandType: 'mouse' | 'keyboard'): CommonAction<ISendCommandAction> =>
        createIncomingActionWithPayload(CommonActionType.SEND_COMMAND, { command, commandType }),
    moveCellUp: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.MOVE_CELL_UP, { cellId }),
    moveCellDown: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.MOVE_CELL_DOWN, { cellId }),
    changeCellType: (cellId: string, currentCode: string): CommonAction<IChangeCellTypeAction> =>
        createIncomingActionWithPayload(CommonActionType.CHANGE_CELL_TYPE, { cellId, currentCode }),
    toggleLineNumbers: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.TOGGLE_LINE_NUMBERS, { cellId }),
    toggleOutput: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.TOGGLE_OUTPUT, { cellId }),
    deleteCell: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(InteractiveWindowMessages.DeleteCell, { cellId }),
    undo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Undo),
    redo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Redo),
    arrowUp: (cellId: string, code: string): CommonAction<ICodeAction> => createIncomingActionWithPayload(CommonActionType.ARROW_UP, { cellId, code }),
    arrowDown: (cellId: string, code: string): CommonAction<ICodeAction> => createIncomingActionWithPayload(CommonActionType.ARROW_DOWN, { cellId, code }),
    editCell: (cellId: string, changes: monacoEditor.editor.IModelContentChange[], modelId: string, code: string): CommonAction<IEditCellAction> =>
        createIncomingActionWithPayload(CommonActionType.EDIT_CELL, { cellId, changes, modelId, code }),
    linkClick: (href: string): CommonAction<ILinkClickAction> => createIncomingActionWithPayload(CommonActionType.LINK_CLICK, { href }),
    showPlot: (imageHtml: string): CommonAction<string> => createIncomingActionWithPayload(InteractiveWindowMessages.ShowPlot, imageHtml),
    gatherCell: (cellId: string | undefined): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.GATHER_CELL, { cellId }),
    editorLoaded: (): CommonAction => createIncomingAction(CommonActionType.EDITOR_LOADED),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> =>
        createIncomingActionWithPayload(CommonActionType.CODE_CREATED, { cellId, modelId }),
    loadedAllCells: (): CommonAction => createIncomingAction(CommonActionType.LOADED_ALL_CELLS),
    editorUnmounted: (): CommonAction => createIncomingAction(CommonActionType.UNMOUNT),
    selectKernel: (): CommonAction => createIncomingAction(InteractiveWindowMessages.SelectKernel),
    selectServer: (): CommonAction => createIncomingAction(CommonActionType.SELECT_SERVER),
    getVariableData: (newExecutionCount: number, startIndex: number = 0, pageSize: number = 100): CommonAction<IJupyterVariablesRequest> =>
        createIncomingActionWithPayload(CommonActionType.GET_VARIABLE_DATA, { executionCount: newExecutionCount, sortColumn: 'name', sortAscending: true, startIndex, pageSize })
};
