// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { ILoadAllCells } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IGetCssResponse } from '../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../client/datascience/monacoMessages';
import { ICell } from '../../../client/datascience/types';
import { IMainState, IServerState } from '../../interactive-common/mainState';
import { IncomingMessageActions } from '../../interactive-common/redux/postOffice';
import {
    CommonActionType,
    IAddCellAction,
    ICellAction,
    ICellAndCursorAction,
    IChangeCellTypeAction,
    ICodeAction,
    IEditCellAction,
    IExecuteAction,
    ILinkClickAction,
    ISendCommandAction,
    IShowDataViewerAction,
    IShowPlotAction
} from '../../interactive-common/redux/reducers/types';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';

type NativeEditorReducerFunc<T> = ReducerFunc<IMainState, CommonActionType, T>;

export type NativeEditorReducerArg<T = never | undefined> = ReducerArg<IMainState, CommonActionType, T>;

export class INativeEditorActionMapping {
    public [CommonActionType.INSERT_ABOVE]: NativeEditorReducerFunc<ICellAction & IAddCellAction>;
    public [CommonActionType.INSERT_BELOW]: NativeEditorReducerFunc<ICellAction & IAddCellAction>;
    public [CommonActionType.INSERT_ABOVE_FIRST]: NativeEditorReducerFunc<IAddCellAction>;
    public [CommonActionType.FOCUS_CELL]: NativeEditorReducerFunc<ICellAndCursorAction>;
    public [CommonActionType.UNFOCUS_CELL]: NativeEditorReducerFunc<ICodeAction>;
    public [CommonActionType.ADD_NEW_CELL]: NativeEditorReducerFunc<IAddCellAction>;
    public [CommonActionType.EXECUTE_CELL]: NativeEditorReducerFunc<IExecuteAction>;
    public [CommonActionType.EXECUTE_ALL_CELLS]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.EXECUTE_ABOVE]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.EXECUTE_CELL_AND_BELOW]: NativeEditorReducerFunc<ICodeAction>;
    public [CommonActionType.RESTART_KERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.INTERRUPT_KERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.CLEAR_ALL_OUTPUTS]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.EXPORT]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.SAVE]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.UNDO]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.REDO]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.SHOW_DATA_VIEWER]: NativeEditorReducerFunc<IShowDataViewerAction>;
    public [CommonActionType.SEND_COMMAND]: NativeEditorReducerFunc<ISendCommandAction>;
    public [CommonActionType.SELECT_CELL]: NativeEditorReducerFunc<ICellAndCursorAction>;
    public [CommonActionType.MOVE_CELL_UP]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.MOVE_CELL_DOWN]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.TOGGLE_LINE_NUMBERS]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.TOGGLE_OUTPUT]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.DELETE_CELL]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.ARROW_UP]: NativeEditorReducerFunc<ICodeAction>;
    public [CommonActionType.ARROW_DOWN]: NativeEditorReducerFunc<ICodeAction>;
    public [CommonActionType.CHANGE_CELL_TYPE]: NativeEditorReducerFunc<IChangeCellTypeAction>;
    public [CommonActionType.EDIT_CELL]: NativeEditorReducerFunc<IEditCellAction>;
    public [CommonActionType.LINK_CLICK]: NativeEditorReducerFunc<ILinkClickAction>;
    public [CommonActionType.SHOW_PLOT]: NativeEditorReducerFunc<IShowPlotAction>;
    public [CommonActionType.GATHER_CELL]: NativeEditorReducerFunc<ICellAction>;
    public [CommonActionType.EDITOR_LOADED]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.LOADED_ALL_CELLS]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.UNMOUNT]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.SELECT_KERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [CommonActionType.SELECT_SERVER]: NativeEditorReducerFunc<never | undefined>;

    // Messages from the extension
    public [IncomingMessageActions.STARTCELL]: NativeEditorReducerFunc<ICell>;
    public [IncomingMessageActions.FINISHCELL]: NativeEditorReducerFunc<ICell>;
    public [IncomingMessageActions.UPDATECELL]: NativeEditorReducerFunc<ICell>;
    public [IncomingMessageActions.NOTEBOOKDIRTY]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.NOTEBOOKCLEAN]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.LOADALLCELLS]: NativeEditorReducerFunc<ILoadAllCells>;
    public [IncomingMessageActions.NOTEBOOKRUNALLCELLS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.NOTEBOOKRUNSELECTEDCELL]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.NOTEBOOKADDCELLBELOW]: NativeEditorReducerFunc<IAddCellAction>;
    public [IncomingMessageActions.DOSAVE]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.DELETEALLCELLS]: NativeEditorReducerFunc<IAddCellAction>;
    public [IncomingMessageActions.UNDO]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.REDO]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.STARTPROGRESS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.STOPPROGRESS]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.UPDATESETTINGS]: NativeEditorReducerFunc<string>;
    public [IncomingMessageActions.ACTIVATE]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.RESTARTKERNEL]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETCSSRESPONSE]: NativeEditorReducerFunc<IGetCssResponse>;
    public [IncomingMessageActions.MONACOREADY]: NativeEditorReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETMONACOTHEMERESPONSE]: NativeEditorReducerFunc<IGetMonacoThemeResponse>;
    public [IncomingMessageActions.UPDATEKERNEL]: NativeEditorReducerFunc<IServerState>;
    public [IncomingMessageActions.LOCINIT]: NativeEditorReducerFunc<string>;
}
