// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IJupyterVariable, IJupyterVariablesRequest } from '../../../client/datascience/types';
import { createIncomingAction, createIncomingActionWithPayload } from '../../interactive-common/redux/helpers';
import {
    CommonAction,
    CommonActionType,
    ICellAction,
    ICodeAction,
    ICodeCreatedAction,
    IEditCellAction,
    ILinkClickAction,
    IScrollAction,
    IShowDataViewerAction
} from '../../interactive-common/redux/reducers/types';

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    restartKernel: (): CommonAction => createIncomingAction(CommonActionType.RESTART_KERNEL),
    interruptKernel: (): CommonAction => createIncomingAction(CommonActionType.INTERRUPT_KERNEL),
    deleteAllCells: (): CommonAction => createIncomingAction(InteractiveWindowMessages.DeleteAllCells),
    deleteCell: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(InteractiveWindowMessages.DeleteCell, { cellId }),
    undo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Undo),
    redo: (): CommonAction => createIncomingAction(InteractiveWindowMessages.Redo),
    linkClick: (href: string): CommonAction<ILinkClickAction> => createIncomingActionWithPayload(CommonActionType.LINK_CLICK, { href }),
    showPlot: (imageHtml: string): CommonAction<string> => createIncomingActionWithPayload(InteractiveWindowMessages.ShowPlot, imageHtml),
    toggleInputBlock: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.TOGGLE_INPUT_BLOCK, { cellId }),
    gotoCell: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.GOTO_CELL, { cellId }),
    copyCellCode: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.COPY_CELL_CODE, { cellId }),
    gatherCell: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.GATHER_CELL, { cellId }),
    clickCell: (cellId: string): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.CLICK_CELL, { cellId }),
    editCell: (cellId: string, changes: monacoEditor.editor.IModelContentChange[], modelId: string, code: string): CommonAction<IEditCellAction> =>
        createIncomingActionWithPayload(CommonActionType.EDIT_CELL, { cellId, changes, modelId, code }),
    submitInput: (code: string, cellId: string): CommonAction<ICodeAction> => createIncomingActionWithPayload(CommonActionType.SUBMIT_INPUT, { code, cellId }),
    toggleVariableExplorer: (): CommonAction => createIncomingAction(CommonActionType.TOGGLE_VARIABLE_EXPLORER),
    expandAll: (): CommonAction => createIncomingAction(InteractiveWindowMessages.ExpandAll),
    collapseAll: (): CommonAction => createIncomingAction(InteractiveWindowMessages.CollapseAll),
    export: (): CommonAction => createIncomingAction(CommonActionType.EXPORT),
    showDataViewer: (variable: IJupyterVariable, columnSize: number): CommonAction<IShowDataViewerAction> =>
        createIncomingActionWithPayload(CommonActionType.SHOW_DATA_VIEWER, { variable, columnSize }),
    editorLoaded: (): CommonAction => createIncomingAction(CommonActionType.EDITOR_LOADED),
    scroll: (isAtBottom: boolean): CommonAction<IScrollAction> => createIncomingActionWithPayload(CommonActionType.SCROLL, { isAtBottom }),
    unfocus: (cellId: string | undefined): CommonAction<ICellAction> => createIncomingActionWithPayload(CommonActionType.UNFOCUS_CELL, { cellId }),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> =>
        createIncomingActionWithPayload(CommonActionType.CODE_CREATED, { cellId, modelId }),
    editorUnmounted: (): CommonAction => createIncomingAction(CommonActionType.UNMOUNT),
    selectKernel: (): CommonAction => createIncomingAction(InteractiveWindowMessages.SelectKernel),
    selectServer: (): CommonAction => createIncomingAction(CommonActionType.SELECT_SERVER),
    getVariableData: (newExecutionCount: number, startIndex: number = 0, pageSize: number = 100): CommonAction<IJupyterVariablesRequest> =>
        createIncomingActionWithPayload(CommonActionType.GET_VARIABLE_DATA, { executionCount: newExecutionCount, sortColumn: 'name', sortAscending: true, startIndex, pageSize })
};
