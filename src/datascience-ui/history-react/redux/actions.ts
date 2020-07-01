// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import {
    IInteractiveWindowMapping,
    InteractiveWindowMessages
} from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable, IJupyterVariablesRequest } from '../../../client/datascience/types';
import {
    CommonAction,
    CommonActionType,
    CommonActionTypeMapping,
    ICellAction,
    ICodeAction,
    ICodeCreatedAction,
    IEditCellAction,
    ILinkClickAction,
    IOpenSettingsAction,
    IScrollAction,
    IShowDataViewerAction,
    IVariableExplorerHeight
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
    focusInput: (): CommonAction => createIncomingAction(CommonActionType.FOCUS_INPUT),
    restartKernel: (): CommonAction => createIncomingAction(CommonActionType.RESTART_KERNEL),
    interruptKernel: (): CommonAction => createIncomingAction(CommonActionType.INTERRUPT_KERNEL),
    deleteAllCells: (): CommonAction => createIncomingAction(InteractiveWindowMessages.DeleteAllCells),
    deleteCell: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.DELETE_CELL, { cellId }),
    undo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Undo),
    redo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Redo),
    linkClick: (href: string): CommonAction<ILinkClickAction> =>
        createIncomingActionWithPayload(CommonActionType.LINK_CLICK, { href }),
    showPlot: (imageHtml: string) => createIncomingActionWithPayload(InteractiveWindowMessages.ShowPlot, imageHtml),
    toggleInputBlock: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.TOGGLE_INPUT_BLOCK, { cellId }),
    gotoCell: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.GOTO_CELL, { cellId }),
    copyCellCode: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.COPY_CELL_CODE, { cellId }),
    gatherCell: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.GATHER_CELL, { cellId }),
    gatherCellToScript: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.GATHER_CELL_TO_SCRIPT, { cellId }),
    clickCell: (cellId: string): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.CLICK_CELL, { cellId }),
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
    submitInput: (code: string, cellId: string): CommonAction<ICodeAction> =>
        createIncomingActionWithPayload(CommonActionType.SUBMIT_INPUT, { code, cellId }),
    toggleVariableExplorer: (): CommonAction => createIncomingAction(CommonActionType.TOGGLE_VARIABLE_EXPLORER),
    setVariableExplorerHeight: (containerHeight: number, gridHeight: number): CommonAction<IVariableExplorerHeight> =>
        createIncomingActionWithPayload(CommonActionType.SET_VARIABLE_EXPLORER_HEIGHT, { containerHeight, gridHeight }),
    expandAll: (): CommonAction => createIncomingAction(InteractiveWindowMessages.ExpandAll),
    collapseAll: (): CommonAction => createIncomingAction(InteractiveWindowMessages.CollapseAll),
    export: (): CommonAction => createIncomingAction(CommonActionType.EXPORT),
    exportAs: (): CommonAction => createIncomingAction(CommonActionType.EXPORT_NOTEBOOK_AS),
    showDataViewer: (variable: IJupyterVariable, columnSize: number): CommonAction<IShowDataViewerAction> =>
        createIncomingActionWithPayload(CommonActionType.SHOW_DATA_VIEWER, { variable, columnSize }),
    editorLoaded: (): CommonAction => createIncomingAction(CommonActionType.EDITOR_LOADED),
    scroll: (isAtBottom: boolean): CommonAction<IScrollAction> =>
        createIncomingActionWithPayload(CommonActionType.SCROLL, { isAtBottom }),
    unfocus: (cellId: string | undefined): CommonAction<ICellAction> =>
        createIncomingActionWithPayload(CommonActionType.UNFOCUS_CELL, { cellId }),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> =>
        createIncomingActionWithPayload(CommonActionType.CODE_CREATED, { cellId, modelId }),
    editorUnmounted: (): CommonAction => createIncomingAction(CommonActionType.UNMOUNT),
    selectKernel: (): CommonAction => createIncomingAction(InteractiveWindowMessages.SelectKernel),
    selectServer: (): CommonAction => createIncomingAction(CommonActionType.SELECT_SERVER),
    openSettings: (setting?: string): CommonAction<IOpenSettingsAction> =>
        createIncomingActionWithPayload(CommonActionType.OPEN_SETTINGS, { setting }),
    getVariableData: (
        newExecutionCount: number,
        refreshCount: number,
        startIndex: number = 0,
        pageSize: number = 100
    ): CommonAction<IJupyterVariablesRequest> =>
        createIncomingActionWithPayload(CommonActionType.GET_VARIABLE_DATA, {
            executionCount: newExecutionCount,
            sortColumn: 'name',
            sortAscending: true,
            startIndex,
            pageSize,
            refreshCount
        }),
    widgetFailed: (ex: Error): CommonAction<Error> =>
        createIncomingActionWithPayload(CommonActionType.IPYWIDGET_RENDER_FAILURE, ex)
};
