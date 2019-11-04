// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import {
    ILoadAllCells,
    InteractiveWindowMessages
} from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CssMessages, IGetCssResponse, IGetMonacoThemeRequest } from '../../../client/datascience/messages';
import { ICell, IJupyterVariable, IJupyterVariablesResponse } from '../../../client/datascience/types';
import { IMainState } from '../../interactive-common/mainState';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';
import {
    ICellAction,
    ICellAndCursorAction,
    IChangeCellTypeAction,
    ICodeAction,
    IEditCellAction,
    IOpenLinkAction,
    IRefreshVariablesAction,
    ISendCommandAction,
    IShowDataViewerAction,
    IShowPlotAction,
    NativeEditorActionTypes
} from './actions';

type NativeEditorReducerFunc<T> = ReducerFunc<IMainState, NativeEditorActionTypes, T>;

export type NativeEditorReducerArg<T = never | undefined> = ReducerArg<IMainState, NativeEditorActionTypes, T>;

export class INativeEditorActionMapping {
    public [NativeEditorActionTypes.INSERT_ABOVE]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.INSERT_BELOW]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.INSERT_ABOVE_FIRST]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.FOCUS_CELL]: NativeEditorReducerFunc<ICellAndCursorAction>;
    public [NativeEditorActionTypes.UNFOCUS_CELL]: NativeEditorReducerFunc<ICodeAction>;
    public [NativeEditorActionTypes.ADD_NEW_CELL]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.EXECUTE_CELL]: NativeEditorReducerFunc<ICodeAction>;
    public [NativeEditorActionTypes.EXECUTE_ALL_CELLS]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.EXECUTE_ABOVE]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.EXECUTE_CELL_AND_BELOW]: NativeEditorReducerFunc<ICodeAction>;
    public [NativeEditorActionTypes.TOGGLE_VARIABLE_EXPLORER]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.REFRESH_VARIABLES]: NativeEditorReducerFunc<IRefreshVariablesAction>;
    public [NativeEditorActionTypes.RESTART_KERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.INTERRUPT_KERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.CLEAR_ALL_OUTPUTS]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.EXPORT]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.SAVE]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.UNDO]: NativeEditorReducerFunc<never | undefined>;
    public [NativeEditorActionTypes.SHOW_DATA_VIEWER]: NativeEditorReducerFunc<IShowDataViewerAction>;
    public [NativeEditorActionTypes.SEND_COMMAND]: NativeEditorReducerFunc<ISendCommandAction>;
    public [NativeEditorActionTypes.SELECT_CELL]: NativeEditorReducerFunc<ICellAndCursorAction>;
    public [NativeEditorActionTypes.SELECT_NEXT_CELL]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.MOVE_CELL_UP]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.MOVE_CELL_DOWN]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.TOGGLE_LINE_NUMBERS]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.TOGGLE_OUTPUT]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.DELETE_CELL]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.ARROW_UP]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.ARROW_DOWN]: NativeEditorReducerFunc<ICellAction>;
    public [NativeEditorActionTypes.CHANGE_CELL_TYPE]: NativeEditorReducerFunc<IChangeCellTypeAction>;
    public [NativeEditorActionTypes.EDIT_CELL]: NativeEditorReducerFunc<IEditCellAction>;
    public [NativeEditorActionTypes.OPEN_LINK]: NativeEditorReducerFunc<IOpenLinkAction>;
    public [NativeEditorActionTypes.SHOW_PLOT]: NativeEditorReducerFunc<IShowPlotAction>;

    // Messages from the extension
    public [InteractiveWindowMessages.StartCell]: NativeEditorReducerFunc<ICell>;
    public [InteractiveWindowMessages.FinishCell]: NativeEditorReducerFunc<ICell>;
    public [InteractiveWindowMessages.UpdateCell]: NativeEditorReducerFunc<ICell>;
    public [InteractiveWindowMessages.NotebookDirty]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.NotebookClean]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.LoadAllCells]: NativeEditorReducerFunc<ILoadAllCells>;
    public [InteractiveWindowMessages.NotebookRunAllCells]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.NotebookRunSelectedCell]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.NotebookAddCellBelow]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.DoSave]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.DeleteAllCells]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.Undo]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.Redo]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.StartProgress]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.StopProgress]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.UpdateSettings]: NativeEditorReducerFunc<string>;
    public [InteractiveWindowMessages.Activate]: NativeEditorReducerFunc<never | undefined>;
    public [InteractiveWindowMessages.GetVariablesResponse]: NativeEditorReducerFunc<IJupyterVariablesResponse>;
    public [InteractiveWindowMessages.GetVariableValueResponse]: NativeEditorReducerFunc<IJupyterVariable>;
    public [InteractiveWindowMessages.RestartKernel]: NativeEditorReducerFunc<never | undefined>;
    public [CssMessages.GetCssResponse]: NativeEditorReducerFunc<IGetCssResponse>;
    public [InteractiveWindowMessages.MonacoReady]: NativeEditorReducerFunc<never | undefined>;
}
