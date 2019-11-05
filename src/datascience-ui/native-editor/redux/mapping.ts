// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ILoadAllCells } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IGetCssResponse } from '../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../client/datascience/monacoMessages';
import { ICell, IJupyterVariable, IJupyterVariablesResponse } from '../../../client/datascience/types';
import { IMainState } from '../../interactive-common/mainState';
import { IncomingMessageActions } from '../../interactive-common/redux/postOffice';
import { ICellAction, ICodeAction, IEditCellAction } from '../../interactive-common/redux/reducers/types';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';
import {
    ICellAndCursorAction,
    IChangeCellTypeAction,
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
    public [NativeEditorActionTypes.GATHER_CELL]: NativeEditorReducerFunc<ICellAction>;

    // Messages from the extension
    public [IncomingMessageActions.STARTCELL]: NativeEditorReducerFunc<ICell>;
    public [IncomingMessageActions.FINISHCELL]: NativeEditorReducerFunc<ICell>;
    public [IncomingMessageActions.UPDATECELL]: NativeEditorReducerFunc<ICell>;
    public [IncomingMessageActions.NOTEBOOKDIRTY]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.NOTEBOOKCLEAN]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.LOADALLCELLS]: NativeEditorReducerFunc<ILoadAllCells>;
    public [IncomingMessageActions.NOTEBOOKRUNALLCELLS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.NOTEBOOKRUNSELECTEDCELL]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.NOTEBOOKADDCELLBELOW]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.DOSAVE]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.DELETEALLCELLS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.UNDO]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.REDO]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.STARTPROGRESS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.STOPPROGRESS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.UPDATESETTINGS]: NativeEditorReducerFunc<string>;
    public [IncomingMessageActions.ACTIVATE]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETVARIABLESRESPONSE]: NativeEditorReducerFunc<IJupyterVariablesResponse>;
    public [IncomingMessageActions.GETVARIABLEVALUERESPONSE]: NativeEditorReducerFunc<IJupyterVariable>;
    public [IncomingMessageActions.RESTARTKERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETCSSRESPONSE]: NativeEditorReducerFunc<IGetCssResponse>;
    public [IncomingMessageActions.MONACOREADY]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETMONACOTHEMERESPONSE]: NativeEditorReducerFunc<IGetMonacoThemeResponse>;
}
