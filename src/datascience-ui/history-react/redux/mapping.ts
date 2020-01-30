// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IScrollToCell } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { BaseReduxActionPayload } from '../../../client/datascience/interactive-common/types';
import { IGetCssResponse } from '../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../client/datascience/monacoMessages';
import { ICell } from '../../../client/datascience/types';
import { IMainState, IServerState } from '../../interactive-common/mainState';
import { IncomingMessageActions } from '../../interactive-common/redux/postOffice';
import {
    CommonActionType,
    IAddCellAction,
    ICellAction,
    ICodeAction,
    IEditCellAction,
    ILinkClickAction,
    IScrollAction,
    IShowDataViewerAction,
    IShowPlotAction,
    PrimitiveTypeInReduxActionPayload
} from '../../interactive-common/redux/reducers/types';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';

type InteractiveReducerFunc<T = never | undefined> = T extends never | undefined
    ? ReducerFunc<IMainState, CommonActionType, BaseReduxActionPayload>
    : T extends PrimitiveTypeInReduxActionPayload
    ? ReducerFunc<IMainState, CommonActionType, { data: T } & BaseReduxActionPayload>
    : ReducerFunc<IMainState, CommonActionType, T & BaseReduxActionPayload>;

export type InteractiveReducerArg<T = never | undefined> = T extends never | undefined
    ? ReducerArg<IMainState, CommonActionType, BaseReduxActionPayload>
    : T extends PrimitiveTypeInReduxActionPayload
    ? ReducerArg<IMainState, CommonActionType, { data: T } & BaseReduxActionPayload>
    : ReducerArg<IMainState, CommonActionType, T & BaseReduxActionPayload>;

export class IInteractiveActionMapping {
    public [CommonActionType.RESTART_KERNEL]: InteractiveReducerFunc;
    public [CommonActionType.SELECT_KERNEL]: InteractiveReducerFunc;
    public [CommonActionType.SELECT_SERVER]: InteractiveReducerFunc;
    public [CommonActionType.INTERRUPT_KERNEL]: InteractiveReducerFunc;
    public [CommonActionType.EXPORT]: InteractiveReducerFunc;
    public [CommonActionType.SAVE]: InteractiveReducerFunc;
    public [CommonActionType.UNDO]: InteractiveReducerFunc;
    public [CommonActionType.REDO]: InteractiveReducerFunc;
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
    public [CommonActionType.DELETE_ALL_CELLS]: InteractiveReducerFunc<IAddCellAction>;
    public [CommonActionType.EXPAND_ALL]: InteractiveReducerFunc;
    public [CommonActionType.COLLAPSE_ALL]: InteractiveReducerFunc;
    public [CommonActionType.EDITOR_LOADED]: InteractiveReducerFunc;
    public [CommonActionType.SCROLL]: InteractiveReducerFunc<IScrollAction>;
    public [CommonActionType.CLICK_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.UNFOCUS_CELL]: InteractiveReducerFunc<ICellAction>;
    public [CommonActionType.UNMOUNT]: InteractiveReducerFunc;

    // Messages from the extension
    public [IncomingMessageActions.STARTCELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.FINISHCELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.UPDATECELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.ACTIVATE]: InteractiveReducerFunc;
    public [IncomingMessageActions.RESTARTKERNEL]: InteractiveReducerFunc;
    public [IncomingMessageActions.GETCSSRESPONSE]: InteractiveReducerFunc<IGetCssResponse>;
    public [IncomingMessageActions.MONACOREADY]: InteractiveReducerFunc;
    public [IncomingMessageActions.GETMONACOTHEMERESPONSE]: InteractiveReducerFunc<IGetMonacoThemeResponse>;
    public [IncomingMessageActions.GETALLCELLS]: InteractiveReducerFunc;
    public [IncomingMessageActions.EXPANDALL]: InteractiveReducerFunc;
    public [IncomingMessageActions.COLLAPSEALL]: InteractiveReducerFunc;
    public [IncomingMessageActions.DELETEALLCELLS]: InteractiveReducerFunc<IAddCellAction>;
    public [IncomingMessageActions.STARTPROGRESS]: InteractiveReducerFunc;
    public [IncomingMessageActions.STOPPROGRESS]: InteractiveReducerFunc;
    public [IncomingMessageActions.UPDATESETTINGS]: InteractiveReducerFunc<string>;
    public [IncomingMessageActions.STARTDEBUGGING]: InteractiveReducerFunc;
    public [IncomingMessageActions.STOPDEBUGGING]: InteractiveReducerFunc;
    public [IncomingMessageActions.SCROLLTOCELL]: InteractiveReducerFunc<IScrollToCell>;
    public [IncomingMessageActions.UPDATEKERNEL]: InteractiveReducerFunc<IServerState>;
    public [IncomingMessageActions.LOCINIT]: InteractiveReducerFunc<string>;
}
