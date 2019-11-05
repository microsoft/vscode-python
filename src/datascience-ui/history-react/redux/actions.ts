// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Action } from 'redux';

import { IShowDataViewer, IRefreshVariablesRequest } from '../../../client/datascience/interactive-common/interactiveWindowTypes';

/**
 * How to add a new state change:
 * 1) Add a new action.<name> to NativeEditorActionTypes
 * 2) Add a new interface (or reuse 1 below) if the action takes any parameters (ex: ICellAction)
 * 3) Add a new actionCreator function (this is how you use it from a react control). The creator should 'create' an instance of the action.
 * 4) Add an entry into the INativeEditorActionMapping in mapping.ts. This is how the type of the list of reducers is enforced.
 * 5) Add a new handler for the action under the 'reducer's folder. Handle the expected state change
 * 6) Add the handler to the main reducer map in reducers\index.ts
 */

export enum InteractiveActionTypes {
    TOGGLE_VARIABLE_EXPLORER = 'action.toggle_variable_explorer',
    REFRESH_VARIABLES = 'action.refresh_variables',
    RESTART_KERNEL = 'action.restart_kernel',
    INTERRUPT_KERNEL = 'action.interrupt_kernel',
    EXPORT = 'action.export',
    SAVE = 'action.save',
    SHOW_DATA_VIEWER = 'action.show_data_viewer',
    DELETE_CELL = 'action.delete_cell',
    UNDO = 'action.undo',
    OPEN_LINK = 'action.open_link',
    SHOW_PLOT = 'action.show_plot'
}

export interface ICellAction {
    cellId: string | undefined;
}

export interface IShowDataViewerAction extends IShowDataViewer {
}

export interface IOpenLinkAction {
    uri: monacoEditor.Uri;
}

export interface IShowPlotAction {
    imageHtml: string;
}

type InteractiveAction = Action<InteractiveActionTypes>;

// See https://react-redux.js.org/using-react-redux/connect-mapdispatch#defining-mapdispatchtoprops-as-an-object
export const actionCreators = {
    refreshVariables: (newExecutionCount?: number): InteractiveAction & IRefreshVariablesRequest => ({ type: InteractiveActionTypes.REFRESH_VARIABLES, newExecutionCount }),
    restartKernel: (): InteractiveAction => ({ type: InteractiveActionTypes.RESTART_KERNEL }),
    interruptKernel: (): InteractiveAction => ({ type: InteractiveActionTypes.INTERRUPT_KERNEL }),
    deleteCell: (cellId: string): InteractiveAction & ICellAction => ({ type: InteractiveActionTypes.DELETE_CELL, cellId }),
    undo: (): InteractiveAction => ({ type: InteractiveActionTypes.UNDO }),
    openLink: (uri: monacoEditor.Uri): InteractiveAction & IOpenLinkAction => ({ type: InteractiveActionTypes.OPEN_LINK, uri }),
    showPlot: (imageHtml: string): InteractiveAction & IShowPlotAction => ({ type: InteractiveActionTypes.SHOW_PLOT, imageHtml })
};
