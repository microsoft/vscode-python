// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { IRefreshVariablesRequest } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import {
    CommonAction,
    CommonActionType,
    ICellAction,
    ICodeAction,
    ICodeCreatedAction,
    IEditCellAction,
    ILinkClickAction,
    IScrollAction,
    IShowDataViewerAction,
    IShowPlotAction
} from '../../interactive-common/redux/reducers/types';

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    refreshVariables: (newExecutionCount?: number): CommonAction<IRefreshVariablesRequest> => ({ type: CommonActionType.REFRESH_VARIABLES, payload: { newExecutionCount } }),
    restartKernel: (): CommonAction<never | undefined> => ({ type: CommonActionType.RESTART_KERNEL }),
    interruptKernel: (): CommonAction<never | undefined> => ({ type: CommonActionType.INTERRUPT_KERNEL }),
    deleteAllCells: (): CommonAction<never | undefined> => ({ type: CommonActionType.DELETE_ALL_CELLS }),
    deleteCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.DELETE_CELL, payload: { cellId } }),
    undo: (): CommonAction<never | undefined> => ({ type: CommonActionType.UNDO }),
    redo: (): CommonAction<never | undefined> => ({ type: CommonActionType.REDO }),
    linkClick: (href: string): CommonAction<ILinkClickAction> => ({ type: CommonActionType.LINK_CLICK, payload: { href } }),
    showPlot: (imageHtml: string): CommonAction<IShowPlotAction> => ({ type: CommonActionType.SHOW_PLOT, payload: { imageHtml } }),
    toggleInputBlock: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.TOGGLE_INPUT_BLOCK, payload: { cellId } }),
    gotoCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.GOTO_CELL, payload: { cellId } }),
    copyCellCode: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.COPY_CELL_CODE, payload: { cellId } }),
    gatherCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.GATHER_CELL, payload: { cellId } }),
    clickCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.CLICK_CELL, payload: { cellId } }),
    doubleClickCell: (cellId: string): CommonAction<ICellAction> => ({ type: CommonActionType.DOUBLE_CLICK_CELL, payload: { cellId } }),
    editCell: (cellId: string, changes: monacoEditor.editor.IModelContentChange[], modelId: string): CommonAction<IEditCellAction> => ({
        type: CommonActionType.EDIT_CELL,
        payload: { cellId, changes, modelId }
    }),
    submitInput: (code: string, cellId: string): CommonAction<ICodeAction> => ({ type: CommonActionType.SUBMIT_INPUT, payload: { code, cellId } }),
    toggleVariableExplorer: (): CommonAction<never | undefined> => ({ type: CommonActionType.TOGGLE_VARIABLE_EXPLORER }),
    expandAll: (): CommonAction<never | undefined> => ({ type: CommonActionType.EXPAND_ALL }),
    collapseAll: (): CommonAction<never | undefined> => ({ type: CommonActionType.COLLAPSE_ALL }),
    export: (): CommonAction<never | undefined> => ({ type: CommonActionType.EXPORT }),
    showDataViewer: (variableName: string, columnSize: number): CommonAction<IShowDataViewerAction> => ({
        type: CommonActionType.SHOW_DATA_VIEWER,
        payload: { variableName, columnSize }
    }),
    editorLoaded: (): CommonAction<never | undefined> => ({ type: CommonActionType.EDITOR_LOADED }),
    scroll: (isAtBottom: boolean): CommonAction<IScrollAction> => ({ type: CommonActionType.SCROLL, payload: { isAtBottom } }),
    unfocus: (cellId: string | undefined): CommonAction<ICellAction> => ({ type: CommonActionType.UNFOCUS_CELL, payload: { cellId } }),
    codeCreated: (cellId: string | undefined, modelId: string): CommonAction<ICodeCreatedAction> => ({ type: CommonActionType.CODE_CREATED, payload: { cellId, modelId } }),
    editorUnmounted: (): CommonAction<never | undefined> => ({ type: CommonActionType.UNMOUNT }),
    selectKernel: (): CommonAction<never | undefined> => ({ type: CommonActionType.SELECT_KERNEL }),
    selectServer: (): CommonAction<never | undefined> => ({ type: CommonActionType.SELECT_SERVER })
};
