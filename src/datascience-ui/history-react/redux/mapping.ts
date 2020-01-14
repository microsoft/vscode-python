// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IScrollToCell } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IGetCssResponse } from '../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../client/datascience/monacoMessages';
import { ICell } from '../../../client/datascience/types';
import { IMainState, IServerState } from '../../interactive-common/mainState';
import { IncomingMessageActions } from '../../interactive-common/redux/postOffice';
import {
    CommonActionType,
    ICellAction,
    ICodeAction,
    IEditCellAction,
    ILinkClickAction,
    IScrollAction,
    IShowDataViewerAction,
    IShowPlotAction
} from '../../interactive-common/redux/reducers/types';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';

type InteractiveReducerFunc<T> = ReducerFunc<IMainState, CommonActionType, T>;

export type InteractiveReducerArg<T = never | undefined> = ReducerArg<IMainState, CommonActionType, T>;

export class IInteractiveActionMapping {
    public [CommonActionType.RESTART_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.SELECT_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.SELECT_SERVER]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.INTERRUPT_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.EXPORT]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.SAVE]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.UNDO]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.REDO]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.SHOW_DATA_VIEWER]: InteractiveReducerFunc<IShowDataViewerAction>;
    public [CommonActionType.DELETE_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.LINK_CLICK]: InteractiveReducerFunc<ILinkClickAction>;
    public [CommonActionType.SHOW_PLOT]: InteractiveReducerFunc<IShowPlotAction>;
    public [CommonActionType.TOGGLE_INPUT_BLOCK]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.GOTO_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.COPY_CELL_CODE]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.GATHER_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.EDIT_CELL]: InteractiveReducerFunc<IEditCellAction>;
    public [CommonActionType.SUBMIT_INPUT]: InteractiveReducerFunc<ICodeAction>;
    public [CommonActionType.DELETE_ALL_CELLS]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.EXPAND_ALL]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.COLLAPSE_ALL]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.EDITOR_LOADED]: InteractiveReducerFunc<never | undefined>;
    public [CommonActionType.SCROLL]: InteractiveReducerFunc<IScrollAction>;
    public [CommonActionType.CLICK_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.UNFOCUS_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.UNMOUNT]: InteractiveReducerFunc<never | undefined>;

    // Messages from the extension
    public [IncomingMessageActions.STARTCELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.FINISHCELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.UPDATECELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.ACTIVATE]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.RESTARTKERNEL]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETCSSRESPONSE]: InteractiveReducerFunc<IGetCssResponse>;
    public [IncomingMessageActions.MONACOREADY]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETMONACOTHEMERESPONSE]: InteractiveReducerFunc<IGetMonacoThemeResponse>;
    public [IncomingMessageActions.GETALLCELLS]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.EXPANDALL]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.COLLAPSEALL]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.DELETEALLCELLS]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.STARTPROGRESS]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.STOPPROGRESS]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.UPDATESETTINGS]: InteractiveReducerFunc<string>;
    public [IncomingMessageActions.STARTDEBUGGING]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.STOPDEBUGGING]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.SCROLLTOCELL]: InteractiveReducerFunc<IScrollToCell>;
    public [IncomingMessageActions.UPDATEKERNEL]: InteractiveReducerFunc<IServerState>;
    public [IncomingMessageActions.LOCINIT]: InteractiveReducerFunc<string>;
}
