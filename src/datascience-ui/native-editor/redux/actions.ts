// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as uuid from 'uuid/v4';
import { NativeKeyboardCommandTelemetry, NativeMouseCommandTelemetry } from '../../../client/datascience/constants';
import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable, IJupyterVariablesRequest } from '../../../client/datascience/types';
import { CursorPos } from '../../interactive-common/mainState';
import {
    CommonAction,
    CommonActionType,
    CommonActionTypeMapping,
    ICellAction,
    ICellAndCursorAction,
    ICodeAction,
    ICodeCreatedAction,
    IEditCellAction,
    ILinkClickAction,
    IOpenSettingsAction,
    ISendCommandAction,
    IShowDataViewerAction
} from '../../interactive-common/redux/reducers/types';
import { IMonacoModelContentChangeEvent } from '../../react-common/monacoHelpers';

// This function isn't made common and not exported, to ensure it isn't used elsewhere.
function createIncomingActionWithPayload<
    M extends IInteractiveWindowMapping & CommonActionTypeMapping,
    K extends keyof M
>(type: K, data: M[K]): CommonAction<M[K]> {
    // tslint:disable-next-line: no-any
    return { type, payload: { data, messageDirection: 'incoming' } as any } as any;
}
// This function isn't made common and not exported, to ensure it isn't used elsewhere.
function createIncomingAction(type: CommonActionType | InteractiveWindowMessages): CommonAction {
    return { type, payload: { messageDirection: 'incoming', data: undefined } };
}

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    addCell: () => createIncomingActionWithPayload(CommonActionType.ADD_AND_FOCUS_NEW_CELL, { newCellId: uuid() }),
    insertAboveFirst: () =>
        createIncomingActionWithPayload(CommonActionType.INSERT_ABOVE_FIRST_AND_FOCUS_NEW_CELL, { newCellId: uuid() }),
    insertAbove: (cellId: string | undefined) =>
        createIncomingActionWithPayload(CommonActionType.INSERT_ABOVE_AND_FOCUS_NEW_CELL, {
            cellId,
            newCellId: uuid()
        }),
    insertBelow: (cellId: string | undefined) =>
        createIncomingActionWithPayload(CommonActionType.INSERT_BELOW_AND_FOCUS_NEW_CELL, {
            cellId,
            newCellId: uuid()
        }),
    executeCell: (cellId: string, moveOp: 'add' | 'select' | 'none') =>
        createIncomingActionWithPayload(CommonActionType.EXECUTE_CELL_AND_ADVANCE, { cellId, moveOp }),
    focusCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> =>
        createIncomingActionWithPayload(CommonActionType.FOCUS_CELL, { cellId, cursorPos }),
    unfocusCell: (cellId: string, code: string) =>
        createIncomingActionWithPayload(CommonActionType.UNFOCUS_CELL, { cellId, code }),
    selectCell: (cellId: string, cursorPos: CursorPos = CursorPos.Current): CommonAction<ICellAndCursorAction> =>
        createIncomingActionWithPayload(CommonActionType.SELECT_CELL, { cellId, cursorPos }),
    executeAllCells: (): CommonAction => createIncomingAction(CommonActionType.EXECUTE_ALL_CELLS),
    executeAbove: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.EXECUTE_ABOVE, { cellId }),
    executeCellAndBelow: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.EXECUTE_CELL_AND_BELOW, { cellId }),
    toggleVariableExplorer: (): CommonAction => createIncomingAction(CommonActionType.TOGGLE_VARIABLE_EXPLORER),
    restartKernel: (): CommonAction => createIncomingAction(CommonActionType.RESTART_KERNEL),
    interruptKernel: (): CommonAction => createIncomingAction(CommonActionType.INTERRUPT_KERNEL),
    clearAllOutputs: (): CommonAction => createIncomingAction(InteractiveWindowMessages.ClearAllOutputs),
    export: (): CommonAction => createIncomingAction(CommonActionType.EXPORT),
    save: (): CommonAction => createIncomingAction(CommonActionType.SAVE),
    showDataViewer: (variable: IJupyterVariable, columnSize: number): CommonAction<IShowDataViewerAction> =>
        createIncomingActionWithPayload(CommonActionType.SHOW_DATA_VIEWER, { variable, columnSize }),
    sendCommand: (
        command: NativeKeyboardCommandTelemetry | NativeMouseCommandTelemetry
    ): CommonAction<ISendCommandAction> => createIncomingActionWithPayload(CommonActionType.SEND_COMMAND, { command }),
    moveCellUp: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.MOVE_CELL_UP, { cellId }),
    moveCellDown: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.MOVE_CELL_DOWN, { cellId }),
    changeCellType: (cellId: string) => createIncomingActionWithPayload(CommonActionType.CHANGE_CELL_TYPE, { cellId }),
    toggleLineNumbers: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.TOGGLE_LINE_NUMBERS, { cellId }),
    toggleOutput: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.TOGGLE_OUTPUT, { cellId }),
    deleteCell: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.DELETE_CELL, { cellId }),
    undo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Undo),
    redo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Redo),
    arrowUp: (cellId: string, code: string): CommonAction<ICodeAction> =>
        createIncomingActionWithPayload(CommonActionType.ARROW_UP, { cellId, code }),
    arrowDown: (cellId: string, code: string): CommonAction<ICodeAction> =>
        createIncomingActionWithPayload(CommonActionType.ARROW_DOWN, { cellId, code }),
    editCell: (cellId: string, e: IMonacoModelContentChangeEvent): CommonAction<IEditCellAction> =>
        createIncomingActionWithPayload(CommonActionType.EDIT_CELL, {
            cellId,
            version: e.versionId,
            modelId: e.model.id,
            forward: e.forward,
            reverse: e.reverse,
            id: cellId,
            code: e.model.getValue()
        }),
    linkClick: (href: string): CommonAction<ILinkClickAction> =>
        createIncomingActionWithPayload(CommonActionType.LINK_CLICK, { href }),
    showPlot: (imageHtml: string) => createIncomingActionWithPayload(InteractiveWindowMessages.ShowPlot, imageHtml),
    gatherCell: (cellId: string | undefined): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.GATHER_CELL, { cellId }),
    gatherCellToScript: (cellId: string | undefined): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.GATHER_CELL_TO_SCRIPT, { cellId }),
    editorLoaded: (): CommonAction => createIncomingAction(CommonActionType.EDITOR_LOADED),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> =>
        createIncomingActionWithPayload(CommonActionType.CODE_CREATED, { cellId, modelId }),
    loadedAllCells: (): CommonAction => createIncomingAction(CommonActionType.LOADED_ALL_CELLS),
    editorUnmounted: (): CommonAction => createIncomingAction(CommonActionType.UNMOUNT),
    selectKernel: (): CommonAction => createIncomingAction(InteractiveWindowMessages.SelectKernel),
    selectServer: (): CommonAction => createIncomingAction(CommonActionType.SELECT_SERVER),
    openSettings: (setting?: string): CommonAction<IOpenSettingsAction> =>
        createIncomingActionWithPayload(CommonActionType.OPEN_SETTINGS, { setting }),
    getVariableData: (
        newExecutionCount: number,
        startIndex: number = 0,
        pageSize: number = 100
    ): CommonAction<IJupyterVariablesRequest> =>
        createIncomingActionWithPayload(CommonActionType.GET_VARIABLE_DATA, {
            executionCount: newExecutionCount,
            sortColumn: 'name',
            sortAscending: true,
            startIndex,
            pageSize
        }),
    widgetFailed: (ex: Error): CommonAction<Error> =>
        createIncomingActionWithPayload(CommonActionType.IPYWIDGET_RENDER_FAILURE, ex),
    runByLine: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.RUN_BY_LINE, { cellId }),
    continue: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.CONTINUE, { cellId }),
    step: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.STEP, { cellId })
};
