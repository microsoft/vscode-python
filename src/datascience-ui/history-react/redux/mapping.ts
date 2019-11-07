// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { IRefreshVariablesRequest } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { IGetCssResponse } from '../../../client/datascience/messages';
import { IGetMonacoThemeResponse } from '../../../client/datascience/monacoMessages';
import { ICell, IJupyterVariable, IJupyterVariablesResponse } from '../../../client/datascience/types';
import { IMainState } from '../../interactive-common/mainState';
import { IncomingMessageActions } from '../../interactive-common/redux/postOffice';
import { ICellAction, ICodeAction, IEditCellAction } from '../../interactive-common/redux/reducers/types';
import { ReducerArg, ReducerFunc } from '../../react-common/reduxUtils';
import { InteractiveActionTypes, IOpenLinkAction, IScrollAction, IShowDataViewerAction, IShowPlotAction } from './actions';

type InteractiveReducerFunc<T> = ReducerFunc<IMainState, InteractiveActionTypes, T>;

export type InteractiveReducerArg<T = never | undefined> = ReducerArg<IMainState, InteractiveActionTypes, T>;

export class IInteractiveActionMapping {
    public [InteractiveActionTypes.TOGGLE_VARIABLE_EXPLORER]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.REFRESH_VARIABLES]: InteractiveReducerFunc<IRefreshVariablesRequest>;
    public [InteractiveActionTypes.RESTART_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.INTERRUPT_KERNEL]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.EXPORT]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.SAVE]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.UNDO]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.REDO]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.SHOW_DATA_VIEWER]: InteractiveReducerFunc<IShowDataViewerAction>;
    public [InteractiveActionTypes.DELETE_CELL]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.OPEN_LINK]: InteractiveReducerFunc<IOpenLinkAction>;
    public [InteractiveActionTypes.SHOW_PLOT]: InteractiveReducerFunc<IShowPlotAction>;
    public [InteractiveActionTypes.TOGGLE_INPUT_BLOCK]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.GOTO_CELL]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.COPY_CELL_CODE]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.GATHER_CELL]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.EDIT_CELL]: InteractiveReducerFunc<IEditCellAction>;
    public [InteractiveActionTypes.SUBMIT_INPUT]: InteractiveReducerFunc<ICodeAction>;
    public [InteractiveActionTypes.DELETE_ALL_CELLS]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.EXPAND_ALL]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.COLLAPSE_ALL]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.EDITOR_LOADED]: InteractiveReducerFunc<never | undefined>;
    public [InteractiveActionTypes.SCROLL]: InteractiveReducerFunc<IScrollAction>;
    public [InteractiveActionTypes.CLICK_CELL]: InteractiveReducerFunc<ICellAction>;
    public [InteractiveActionTypes.UNFOCUS_CELL]: InteractiveReducerFunc<ICellAction>;

    // Messages from the extension
    public [IncomingMessageActions.STARTCELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.FINISHCELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.UPDATECELL]: InteractiveReducerFunc<ICell>;
    public [IncomingMessageActions.ACTIVATE]: InteractiveReducerFunc<never | undefined>;
    public [IncomingMessageActions.GETVARIABLESRESPONSE]: InteractiveReducerFunc<IJupyterVariablesResponse>;
    public [IncomingMessageActions.GETVARIABLEVALUERESPONSE]: InteractiveReducerFunc<IJupyterVariable>;
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
    public [IncomingMessageActions.SCROLLTOCELL]: InteractiveReducerFunc<ICellAction>;
}
